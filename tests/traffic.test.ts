import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../lib/database.ts';
import { createApi } from '../lib/api.ts';
import { passwordHash } from '../lib/auth.ts';
import { trafficDetails, trafficIp } from '../lib/traffic.ts';

test('Traffic counts sessions without exposing visitor details and encrypts retained IPs', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'profile-traffic-'));
  const database = openDatabase(directory);
  const oldKey = process.env.GITHUB_CREDENTIAL_KEY;
  const oldVercel = process.env.VERCEL;
  process.env.GITHUB_CREDENTIAL_KEY = 'bc'.repeat(32);
  process.env.VERCEL = '1';
  const origin = 'https://profile.example';
  const handle = createApi(database, true, origin);
  const call = (url: string, method = 'GET', body?: unknown, headers = {}) =>
    handle(
      new Request(origin + url, {
        method,
        headers: {
          origin,
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36',
          'x-vercel-forwarded-for': '203.0.113.9',
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  try {
    assert.equal((await call('/api/admin/traffic')).status, 401);
    assert.equal(
      (await call('/api/traffic', 'POST', { path: '/' }, { origin: 'https://evil.example' }))
        .status,
      403,
    );
    assert.equal((await call('/api/traffic', 'POST', { path: '/admin' })).status, 400);
    assert.equal((await call('/api/traffic', 'POST', { path: '/?secret=value' })).status, 400);
    const first = await call('/api/traffic', 'POST', { path: '/' });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { views: 1 });
    assert.match(first.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax; Max-Age=1800; Secure/);
    const cookie = first.headers.get('set-cookie')!.split(';')[0];
    assert.deepEqual(await (await call('/api/traffic', 'POST', { path: '/' }, { cookie })).json(), {
      views: 1,
    });
    await call('/api/traffic', 'POST', { path: '/activity' }, { cookie });
    const rows = database.db.prepare('SELECT * FROM traffic_visits').all() as Array<{ ip: string }>;
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.ip && !row.ip.includes('203.0.113.9')));
    const details = await trafficDetails(database, 1, 'chrome');
    assert.equal(details.visits, 1);
    assert.equal(details.pageViews, 2);
    assert.equal(details.profileViews, 1);
    assert.equal(details.entries[0].ip, '203.0.113.9');
    assert.equal((await trafficDetails(database, 1, 'firefox')).total, 0);
    assert.equal((await trafficDetails(database, 2, '')).entries.length, 0);
    assert.deepEqual(await (await call('/api/traffic')).json(), { views: 1 });
    await call('/api/traffic', 'POST', { path: '/' }, { 'user-agent': 'Googlebot' });
    assert.equal((await trafficDetails(database, 1, '')).visits, 1);
    await call(
      '/api/traffic',
      'POST',
      { path: '/' },
      { cookie: cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a') },
    );
    assert.equal((await trafficDetails(database, 1, '')).visits, 2);
    database.db
      .prepare('INSERT INTO admins VALUES(?,?)')
      .run('owner', await passwordHash('test-traffic-only-password'));
    const login = await call('/api/login', 'POST', {
      username: 'owner',
      password: 'test-traffic-only-password',
    });
    const adminCookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.equal(
      (await call('/api/admin/traffic', 'GET', undefined, { cookie: adminCookie })).status,
      200,
    );
    await call('/api/traffic', 'POST', { path: '/' }, { cookie: adminCookie });
    assert.equal((await trafficDetails(database, 1, '')).visits, 2);
    database.db.prepare('UPDATE traffic_visits SET created_at=?').run(Date.now() - 31 * 86400_000);
    const expired = await trafficDetails(database, 1, '');
    assert.equal(expired.entries.length, 0);
    assert.equal(expired.visits, 2);
    assert.ok(
      (
        database.db.prepare('SELECT ip,user_agent FROM traffic_visits').all() as Array<{
          ip: string;
          user_agent: string;
        }>
      ).every((row) => !row.ip && !row.user_agent),
    );
    assert.equal(
      trafficIp(new Request(origin, { headers: { 'x-forwarded-for': '203.0.113.99' } })),
      '',
    );
    assert.equal(
      trafficIp(new Request(origin, { headers: { 'x-vercel-forwarded-for': 'invalid' } })),
      '',
    );
  } finally {
    if (oldKey === undefined) delete process.env.GITHUB_CREDENTIAL_KEY;
    else process.env.GITHUB_CREDENTIAL_KEY = oldKey;
    if (oldVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = oldVercel;
    database.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
