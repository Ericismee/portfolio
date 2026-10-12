import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { Connection, SqlValue } from './database.ts';

// Application-owned identifiers; never accept SQL identifiers from a downloaded archive.
export const backupTables = [
  'content',
  'admins',
  'admin_profiles',
  'admin_mfa',
  'revisions',
  'messages',
  'github_connection',
  'traffic_visits',
  'traffic_context',
  'traffic_durations',
] as const;
export type BackupSnapshot = {
  format: 'eric-profile-backup-v1';
  createdAt: string;
  credentialKey: string;
  tables: Record<string, Record<string, SqlValue>[]>;
  assets: string[];
};
export async function captureBackup(
  db: Connection,
  credentialKey: string,
): Promise<BackupSnapshot> {
  if (!/^[a-f0-9]{64}$/i.test(credentialKey)) throw Error('Credential key unavailable');
  const tables: BackupSnapshot['tables'] = {};
  for (const table of backupTables) {
    // Fail visibly instead of silently producing an incomplete oversized backup.
    const rows = await db.prepare(`SELECT * FROM ${table} LIMIT 1000001`).all();
    if (rows.length > 1000000) throw Error('Backup requires streaming export for this table');
    tables[table] = rows as Record<string, SqlValue>[];
  }
  return {
    format: 'eric-profile-backup-v1',
    createdAt: new Date().toISOString(),
    credentialKey,
    tables,
    assets: [],
  };
}
function backupKey(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw Error('BACKUP_ENCRYPTION_KEY must contain 32 random bytes encoded as hex');
  return Buffer.from(value, 'hex');
}
const magic = Buffer.from('ERICBACKUP1');
export function encryptBackup(snapshot: BackupSnapshot, key: string) {
  const bytes = Buffer.from(JSON.stringify(snapshot));
  if (bytes.length > 100 * 1024 * 1024) throw Error('Backup exceeds the bounded snapshot size');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', backupKey(key), iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(gzipSync(bytes)), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptBackup(bytes: Buffer, key: string): BackupSnapshot {
  if (bytes.length < 39 || !timingSafeEqual(bytes.subarray(0, 11), magic))
    throw Error('Invalid backup');
  const decipher = createDecipheriv('aes-256-gcm', backupKey(key), bytes.subarray(11, 23));
  decipher.setAAD(magic);
  decipher.setAuthTag(bytes.subarray(23, 39));
  const compressed = Buffer.concat([decipher.update(bytes.subarray(39)), decipher.final()]);
  const snapshot = JSON.parse(
    gunzipSync(compressed, { maxOutputLength: 100 * 1024 * 1024 }).toString(),
  ) as BackupSnapshot;
  if (
    snapshot.format !== 'eric-profile-backup-v1' ||
    !/^[a-f0-9]{64}$/i.test(snapshot.credentialKey) ||
    backupTables.some((table) => !Array.isArray(snapshot.tables[table]))
  )
    throw Error('Invalid backup schema');
  return snapshot;
}

// Intended only for a fresh, isolated database. No production restore HTTP endpoint exists.
export async function restoreBackup(db: Connection, snapshot: BackupSnapshot) {
  for (const table of backupTables) {
    if (Number(((await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()) as { n: number }).n))
      throw Error('Restore target must be empty');
  }
  for (const table of backupTables) {
    for (const row of snapshot.tables[table]) {
      const columns = Object.keys(row);
      if (!columns.length || columns.some((column) => !/^[a-z_]+$/.test(column)))
        throw Error('Invalid backup columns');
      await db
        .prepare(
          `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
        )
        .run(...Object.values(row));
    }
  }
}
