import { cloudBackup, readCloudBackup } from '../lib/cloud-backup.ts';
import { backupTables, restoreBackup } from '../lib/backup.ts';
import { cloudSchema } from '../lib/cloud-database.ts';
import { accountSchema } from '../lib/database.ts';
import { trafficSchema } from '../lib/traffic.ts';
import { postgresParameters } from '../lib/cloud-database.ts';
import type { Connection } from '../lib/database.ts';
import { get } from '@vercel/blob';
import { credentialKey } from '../lib/credential-key.ts';
import path from 'node:path';

try {
  const remote = process.argv.includes('--remote');
  if (remote)
    process.env.BACKUP_ENCRYPTION_KEY = credentialKey(
      path.resolve('.data/backup-recovery'),
    ).toString('hex');
  const result = remote
    ? await (async () => {
        const response = await fetch(
          (process.env.PUBLIC_ORIGIN || 'https://ericisme.cloud') + '/api/cron/backup',
          {
            headers: {
              authorization:
                'Bearer ' + credentialKey(path.resolve('.data/cron-recovery')).toString('hex'),
            },
            signal: AbortSignal.timeout(300000),
          },
        );
        if (!response.ok) throw Error('Remote backup failed');
        return (await response.json()) as Awaited<ReturnType<typeof cloudBackup>>;
      })()
    : await cloudBackup();
  if (process.argv.includes('--verify')) {
    // In-memory Postgres-compatible restore; no production writes or plaintext files.
    const { PGlite } = await import('@electric-sql/pglite');
    const target = new PGlite();
    try {
      await target.exec(cloudSchema + accountSchema + trafficSchema);
      const db: Connection = {
        exec: async (sql) => {
          await target.exec(sql);
        },
        prepare: (sql) => ({
          all: async (...values) => (await target.query(postgresParameters(sql), values)).rows,
          get: async (...values) => (await target.query(postgresParameters(sql), values)).rows[0],
          run: async (...values) => {
            await target.query(postgresParameters(sql), values);
          },
        }),
      };
      const snapshot = await readCloudBackup(result.pathname);
      await target.exec('BEGIN');
      await restoreBackup(db, snapshot);
      for (const table of backupTables) {
        const count = await target.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
        if (Number(count.rows[0].n) !== result.rows[table]) throw Error('Restore count mismatch');
      }
      await target.exec('COMMIT');
      for (const pathname of snapshot.assets) {
        const asset = await get(pathname, { access: 'private', useCache: false });
        if (!asset || asset.statusCode !== 200) throw Error('Backup file is unavailable');
        let bytes = 0;
        const reader = asset.stream.getReader();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
          }
        } finally {
          reader.releaseLock();
        }
        if (!bytes) throw Error('Backup file is empty');
      }
      console.log(
        'Encrypted backup downloaded and restored successfully in an isolated in-memory database.',
      );
    } finally {
      await target.close();
    }
  }
  console.log(JSON.stringify(result));
} catch {
  console.error('Backup or isolated restore failed. No production restore was attempted.');
  process.exitCode = 1;
}
