import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, RequestError } from '../lib/client.ts';

test('Large saves select staging transport, retain document bytes and preserve conflict status', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const data = { summary: 'x'.repeat(3 * 1024 * 1024 + 1) };
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(new Headers(init?.headers).get('x-csrf-token'), 'test-csrf');
    if (url === '/api/admin/upload-init') {
      const intent = JSON.parse(String(init?.body));
      assert.equal(intent.mime, 'application/json');
      assert(intent.size > 3 * 1024 * 1024);
      return Response.json({ mode: 'local' });
    }
    assert.equal(url, '/api/admin/content');
    assert.equal(init?.method, 'PUT');
    assert.deepEqual(JSON.parse(String(init?.body)), { data, version: 17 });
    return Response.json({ error: 'Content changed' }, { status: 409 });
  };
  try {
    await assert.rejects(
      () => request('/api/admin/content', 'PUT', { data, version: 17 }, 'test-csrf'),
      (error: unknown) => error instanceof RequestError && error.status === 409,
    );
    assert.deepEqual(calls, ['/api/admin/upload-init', '/api/admin/content']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
