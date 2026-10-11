import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from '../server.mjs';
test('Retired server fails closed instead of exposing obsolete upload or content routes', async () => {
  await assert.rejects(createServer(), /retired/);
  const result = spawnSync(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /retired/);
});
