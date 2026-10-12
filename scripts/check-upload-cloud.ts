import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../lib/database.ts';
import { startCloudUpload, finishCloudUpload } from '../lib/cloud-uploads.ts';
import { put } from '@vercel/blob/client';
import { del, get } from '@vercel/blob';
import sharp from 'sharp';

// Real storage transport with a disposable local authorization database.
// No production accounts, content or visitor rows are read or modified.
// This Node diagnostic cannot verify browser CSP/CORS or the upload form.
// Also test the deployed site's browser flow after changing upload policies.
const directory = await mkdtemp(path.join(tmpdir(), 'eric-upload-check-'));
const database = openDatabase(directory);
let staging = '',
  uploaded = '',
  stage = 'initialize';
try {
  database.db.exec(
    'CREATE TABLE upload_intents(id TEXT PRIMARY KEY,username TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,expires BIGINT NOT NULL)',
  );
  const text = process.argv.includes('--text');
  const mime = text ? 'text/plain' : 'image/png';
  const bytes = text
    ? Buffer.from('Synthetic upload diagnostic. No personal data.')
    : await sharp({
        create: { width: 32, height: 32, channels: 3, background: '#4264da' },
      })
        .png()
        .toBuffer();
  stage = 'authorize';
  const intent = await startCloudUpload(database, 'synthetic-upload-check', {
    mime,
    size: bytes.length,
  });
  staging = intent.pathname;
  stage = 'client-transfer';
  await put(intent.pathname, new Blob([new Uint8Array(bytes)]), {
    access: 'private',
    token: intent.token,
    contentType: mime,
    abortSignal: AbortSignal.timeout(30000),
  });
  stage = 'validate-and-copy';
  uploaded = (await finishCloudUpload(database, 'synthetic-upload-check', intent.id)).slice(1);
  stage = 'readback';
  const result = await get(uploaded, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) throw Error('Readback unavailable');
  const received = Buffer.from(await new Response(result.stream).arrayBuffer());
  if (!received.equals(bytes)) throw Error('Readback differs');
  console.log(
    'Cloud client upload, server signature validation, private copy and byte-for-byte readback passed.',
  );
} catch (error) {
  console.error(
    JSON.stringify({
      stage,
      errorType: error instanceof Error ? error.name : 'Unknown',
      message: 'Upload check failed; no credentials printed.',
    }),
  );
  process.exitCode = 1;
} finally {
  // Only paths created by this diagnostic are removed.
  for (const created of [staging, uploaded].filter(Boolean))
    await del(created).catch(() => undefined);
  database.db.close();
  await rm(directory, { recursive: true, force: true });
}
