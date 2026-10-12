import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../lib/database.ts';
import { createApi } from '../lib/api.ts';
import { passwordHash } from '../lib/auth.ts';
import { trafficDetails, trafficIp, trafficGeo, trafficFilterSchema } from '../lib/traffic.ts';

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
          'x-vercel-ip-country': 'VN',
          'x-vercel-ip-city': 'Da%20Lat',
          'x-vercel-ip-country-region': '35',
          'x-vercel-ip-continent': 'AS',
          'x-vercel-ip-latitude': '11.94',
          'x-vercel-ip-longitude': '108.44',
          'x-vercel-ip-timezone': 'Asia/Ho_Chi_Minh',
          'x-vercel-ip-postal-code': '670000',
          'accept-language': 'en-US,en;q=0.9',
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
    const first = await call('/api/traffic', 'POST', {
      path: '/',
      durationTracking: true,
      timezone: 'Asia/Bangkok',
      width: 1440,
      height: 900,
      screenWidth: 1920,
      screenHeight: 1080,
      pixelRatio: 2,
      referrer: 'https://search.example/private?q=secret#hidden',
    });
    assert.equal(first.status, 200);
    const receipt = await first.json();
    assert.equal(receipt.views, 1);
    assert.match(receipt.trackingToken, /^[a-f0-9]{64}\.\d{13}\.[a-f0-9]{64}$/);
    const durationInput = {
      token: receipt.trackingToken,
      instance: '12345678-1234-4234-8234-123456789abc',
      durationMs: 1500,
    };
    database.db.prepare('UPDATE traffic_visits SET created_at=?').run(Date.now() - 120000);
    assert.equal((await call('/api/traffic/duration', 'POST', durationInput)).status, 200);
    assert.equal(
      (await call('/api/traffic/duration', 'POST', { ...durationInput, durationMs: 1200 })).status,
      200,
    );
    assert.equal((await trafficDetails(database, 1, '')).entries[0].durationMs, 1500);
    assert.equal(
      (await call('/api/traffic/duration', 'POST', { ...durationInput, durationMs: 3500 })).status,
      200,
    );
    assert.equal((await trafficDetails(database, 1, '')).entries[0].durationMs, 3500);
    assert.equal(
      (
        await call('/api/traffic/duration', 'POST', {
          ...durationInput,
          token: receipt.trackingToken.slice(0, -1) + 'x',
        })
      ).status,
      400,
    );
    assert.equal(
      (await call('/api/traffic/duration', 'POST', { ...durationInput, durationMs: -1 })).status,
      400,
    );
    assert.equal(
      (
        await call('/api/traffic/duration', 'POST', durationInput, {
          origin: 'https://evil.example',
        })
      ).status,
      403,
    );
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
    const profileEntry = details.entries.find((entry) => entry.path === '/')!;
    assert.equal(profileEntry.country, 'VN');
    assert.equal(profileEntry.city, 'Da Lat');
    assert.equal(profileEntry.referrer, 'https://search.example');
    assert.equal(profileEntry.timezone, 'Asia/Bangkok');
    assert.equal(profileEntry.width, 1440);
    assert.equal(profileEntry.screenWidth, 1920);
    assert.equal(profileEntry.pixelRatio, 2);
    assert.equal(profileEntry.continent, 'AS');
    assert.equal(profileEntry.latitude, '11.94');
    assert.equal(profileEntry.longitude, '108.44');
    assert.equal(profileEntry.geoTimezone, 'Asia/Ho_Chi_Minh');
    assert.equal(profileEntry.postalCode, '670000');
    assert.equal(
      trafficGeo(new Request(origin, { headers: { 'x-vercel-ip-latitude': '999' } }), true)
        .latitude,
      '',
    );
    assert.equal(profileEntry.language, 'en-US,en;q=0.9');
    assert.equal(
      details.daily.reduce((sum, row) => sum + row.views, 0),
      2,
    );
    assert.deepEqual(details.countries, [{ country: 'VN', views: 2, visits: 1 }]);
    assert.equal(
      (await trafficDetails(database, 1, '', { country: 'VN', ip: '203.0.113.9' })).total,
      2,
    );
    assert.equal((await trafficDetails(database, 1, '', { country: 'US' })).total, 0);
    assert.equal((await trafficDetails(database, 1, '', { ip: '203.0.113.10' })).total, 0);
    assert.equal(
      (await trafficDetails(database, 1, '', { path: '/activity', browser: 'Chrome' })).total,
      1,
    );
    assert.equal((await trafficDetails(database, 1, '', { to: '2000-01-01' })).total, 0);
    const contexts = database.db.prepare('SELECT details,ip_hash FROM traffic_context').all();
    assert.ok(!JSON.stringify(contexts).includes('Da Lat'));
    assert.ok(!JSON.stringify(contexts).includes('203.0.113.9'));
    assert.throws(() => trafficFilterSchema.parse({ from: '2026-02-30' }));
    assert.throws(() => trafficFilterSchema.parse({ from: '2026-10-12', to: '2026-10-11' }));
    assert.throws(() => trafficFilterSchema.parse({ ip: "' OR 1=1" }));
    assert.equal(
      trafficGeo(new Request(origin, { headers: { 'x-vercel-ip-country': 'US' } }), false).country,
      '',
    );
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
    const historicalAt = Date.now() - 400 * 86400_000;
    database.db.prepare('UPDATE traffic_visits SET created_at=?').run(historicalAt);
    const historical = await trafficDetails(database, 1, '');
    assert.equal(historical.entries.length, 3);
    assert.equal(historical.visits, 2);
    assert.equal(historical.entries[0].ip, '203.0.113.9');
    assert.equal(historical.entries[0].city, 'Da Lat');
    assert.equal(historical.filtered.pageViews, 3);
    assert.equal(historical.filtered.countries, 1);
    assert.deepEqual(historical.breakdowns.browser, [{ name: 'Chrome', views: 3 }]);
    assert.equal(
      (await trafficDetails(database, 1, '', { country: 'VN', ip: '203.0.113.9' })).total,
      3,
    );
    assert.equal(
      (await trafficDetails(database, 1, '', { from: new Date().toISOString().slice(0, 10) }))
        .total,
      0,
    );
    assert.equal(database.db.prepare('SELECT * FROM traffic_context').all().length, 3);
    assert.ok(
      (
        database.db.prepare('SELECT ip,user_agent FROM traffic_visits').all() as Array<{
          ip: string;
          user_agent: string;
        }>
      ).every((row) => row.ip && row.user_agent),
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
