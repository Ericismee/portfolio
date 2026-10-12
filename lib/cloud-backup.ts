import postgres from 'postgres';
import { copy, get, list, put } from '@vercel/blob';
import { captureBackup, decryptBackup, encryptBackup } from './backup.ts';
import { connection, openCloudDatabase } from './cloud-database.ts';
import { trafficSchema } from './traffic.ts';

async function listAll(prefix: string) {
  const blobs = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}
export async function cloudBackup() {
  const key = process.env.BACKUP_ENCRYPTION_KEY || '';
  if (
    !/^[a-f0-9]{64}$/i.test(key) ||
    !process.env.DATABASE_URL ||
    !process.env.BLOB_READ_WRITE_TOKEN
  )
    throw Error('Cloud backup is not configured');
  // Initialize optional tables before entering the consistent read-only transaction.
  const database = await openCloudDatabase();
  try {
    await database.db.exec(trafficSchema);
  } finally {
    await database.db.close?.();
  }
  const sql = postgres(process.env.DATABASE_URL, {
    ssl: { rejectUnauthorized: true },
    max: 1,
    prepare: false,
  });
  try {
    const snapshot = await sql.begin('isolation level repeatable read read only', async (tx) =>
      captureBackup(
        connection(tx as unknown as postgres.Sql),
        process.env.GITHUB_CREDENTIAL_KEY || '',
      ),
    );
    const originals = await listAll('uploads/');
    const copies = new Set((await listAll('backups/assets/')).map((blob) => blob.pathname));
    for (const original of originals) {
      const destination = 'backups/assets/' + original.pathname.slice('uploads/'.length);
      if (!copies.has(destination))
        await copy(original.pathname, destination, { access: 'private', addRandomSuffix: false });
      snapshot.assets.push(destination);
    }
    const references =
      JSON.stringify(snapshot.tables).match(
        /\/uploads\/[a-f0-9-]+\.(?:png|jpg|gif|webp|svg|pdf|docx|txt|md)/g,
      ) || [];
    const available = new Set(snapshot.assets);
    for (const reference of references) {
      const destination = 'backups/assets/' + reference.slice('/uploads/'.length);
      if (!available.has(destination) && !copies.has(destination))
        throw Error('A referenced file is missing from the backup');
      if (!available.has(destination)) {
        snapshot.assets.push(destination);
        available.add(destination);
      }
    }
    const encrypted = encryptBackup(snapshot, key);
    // Verify authentication and complete manifest before committing the snapshot.
    const verified = decryptBackup(encrypted, key);
    if (verified.assets.length !== snapshot.assets.length)
      throw Error('Backup manifest verification failed');
    const pathname = 'backups/snapshots/' + snapshot.createdAt.replace(/[:.]/g, '-') + '.enc';
    await put(pathname, encrypted, {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/octet-stream',
    });
    return {
      pathname,
      createdAt: snapshot.createdAt,
      assets: snapshot.assets.length,
      rows: Object.fromEntries(
        Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length]),
      ),
      bytes: encrypted.length,
    };
  } finally {
    await sql.end();
  }
}
export async function readCloudBackup(pathname: string) {
  if (!/^backups\/snapshots\/[0-9TZ-]+\.enc$/.test(pathname)) throw Error('Invalid backup path');
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) throw Error('Backup unavailable');
  return decryptBackup(
    Buffer.from(await new Response(result.stream).arrayBuffer()),
    process.env.BACKUP_ENCRYPTION_KEY || '',
  );
}
