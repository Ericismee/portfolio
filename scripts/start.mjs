import { cp } from 'node:fs/promises';
import path from 'node:path';

// Standalone output keeps the same runtime in local production checks and Docker.
// Static chunks are emitted separately by Next.js and must be copied alongside it.
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
process.env.PORT ??= '3001';
process.env.HOSTNAME = process.env.HOST || '127.0.0.1';
// Next's generated standalone server changes cwd; resolve storage first so an
// upgrade never creates an empty database inside the build output directory.
process.env.DATA_DIR = path.resolve(process.env.DATA_DIR || '.data');
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
await import('../.next/standalone/server.js');
