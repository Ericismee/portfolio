import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../next.config.ts';
test('Browser upload policy permits the installed Blob SDK API and private store without opening unrelated origins', async () => {
  const policies = await config.headers!();
  const csp = policies[0].headers.find((header) => header.key === 'Content-Security-Policy')!.value;
  const connect = csp
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('connect-src '))!;
  assert.ok(connect.split(' ').includes('https://vercel.com/api/blob'));
  // Multipart requests use /api/blob/mpu; the trailing slash permits child paths.
  assert.ok(connect.split(' ').includes('https://vercel.com/api/blob/'));
  assert.ok(connect.includes('https://*.blob.vercel-storage.com'));
  assert.ok(!connect.split(' ').some((value) => value === '*' || value === 'https:'));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
});
