import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { put, get } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { openCloudDatabase } from '../lib/cloud-database.ts';
import { contentSchema } from '../lib/schema.ts';
import { uploadExtension, mimeTypes } from '../lib/uploads.ts';

// This command never prints content, password hashes or credentials.
const directory = path.resolve(process.env.DATA_DIR || '.data');
const source = new DatabaseSync(path.join(directory, 'profile.sqlite'), { readOnly: true });
source.exec('BEGIN');
try {
  const row = source.prepare('SELECT version,body FROM content WHERE id=1').get() as {
    version: number;
    body: string;
  };
  contentSchema.parse(JSON.parse(row.body));
  const admins = source.prepare('SELECT username,password_hash FROM admins').all();
  const revisions = source.prepare('SELECT body,created_at FROM revisions ORDER BY id').all();
  const messages = source
    .prepare('SELECT name,email,subject,message,created_at FROM messages ORDER BY id')
    .all();
  const folder = path.join(directory, 'uploads');
  const files = (
    await readdir(folder).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    })
  ).filter((name) => /^[a-f0-9-]+\.(png|jpg|gif|webp|pdf)$/.test(name));
  if (!process.argv.includes('--apply')) {
    console.log(
      JSON.stringify({
        mode: 'dry-run',
        contentVersion: row.version,
        admins: admins.length,
        revisions: revisions.length,
        messages: messages.length,
        files: files.length,
        sessions: 'not migrated',
        githubConnection: 'reconnect after deployment',
      }),
    );
  } else {
    if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN)
      throw Error(
        'Configure DATABASE_URL and private BLOB_READ_WRITE_TOKEN in a private environment file.',
      );
    const target = await openCloudDatabase();
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1, prepare: false });
    try {
      const populated = await sql`SELECT username FROM admins LIMIT 1`;
      const current = await target.read();
      if (populated.length || current.version !== 1)
        throw Error('Destination is not empty. Migration refuses to overwrite existing data.');
      // UUID assets are immutable. On a retry, verify the same bytes rather than overwrite.
      for (const name of files) {
        const bytes = await readFile(path.join(folder, name));
        const mime = mimeTypes[name.split('.').pop()!];
        uploadExtension(bytes, mime);
        const existing = await get('uploads/' + name, { access: 'private', useCache: false });
        if (existing?.statusCode === 200) {
          const digest = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
          const old = new Uint8Array(await new Response(existing.stream).arrayBuffer());
          if (digest(old) !== digest(bytes))
            throw Error('An existing cloud file has different bytes; migration stopped.');
        } else
          await put('uploads/' + name, bytes, {
            access: 'private',
            contentType: mime,
            addRandomSuffix: false,
            allowOverwrite: false,
          });
      }
      await sql.begin(async (tx) => {
        await tx`SELECT id FROM content WHERE id=1 FOR UPDATE`;
        const [fresh] = await tx`SELECT version FROM content WHERE id=1`;
        if (fresh.version !== 1 || (await tx`SELECT username FROM admins LIMIT 1`).length)
          throw Error('Destination changed during migration.');
        await tx`UPDATE content SET version=${row.version},body=${row.body} WHERE id=1`;
        for (const admin of admins)
          await tx`INSERT INTO admins VALUES(${String(admin.username)},${String(admin.password_hash)})`;
        for (const revision of revisions)
          await tx`INSERT INTO revisions(body,created_at) VALUES(${String(revision.body)},${String(revision.created_at)})`;
        for (const message of messages)
          await tx`INSERT INTO messages(name,email,subject,message,created_at) VALUES(${String(message.name)},${String(message.email)},${String(message.subject)},${String(message.message)},${String(message.created_at)})`;
      });
      const migrated = await target.read();
      if (
        migrated.version !== row.version ||
        JSON.stringify(migrated.data) !== JSON.stringify(contentSchema.parse(JSON.parse(row.body)))
      )
        throw Error('Migration verification failed');
      console.log(
        'Migration verified. Existing admin passwords are retained. Sign in again and reconnect GitHub on the deployed site.',
      );
    } finally {
      await target.db.close?.();
      await sql.end();
    }
  }
} finally {
  source.exec('ROLLBACK');
  source.close();
}
