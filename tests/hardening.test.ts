import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { openDatabase, accountSchema } from '../lib/database.ts';
import { createApi } from '../lib/api.ts';
import { passwordHash } from '../lib/auth.ts';
import { beginMfa, confirmMfa, mfaState, totp, verifyMfa } from '../lib/mfa.ts';
import { captureBackup, encryptBackup, decryptBackup, restoreBackup } from '../lib/backup.ts';
import { trafficSchema, refreshTrafficDaily, trafficCsv } from '../lib/traffic.ts';
import { storeUpload } from '../lib/uploads.ts';
import { uploadResponse } from '../lib/upload-response.ts';

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'eric-hardening-'));
  const database = openDatabase(directory);
  await database.db.exec(
    accountSchema +
      trafficSchema +
      'CREATE TABLE IF NOT EXISTS github_connection(id INTEGER PRIMARY KEY,secret TEXT NOT NULL,login TEXT NOT NULL);',
  );
  return {
    database,
    directory,
    async close() {
      database.db.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
test('TOTP matches RFC 6238, encrypted setup expires, and codes cannot be replayed', async () => {
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1), '287082');
  const f = await fixture();
  try {
    f.database.db.prepare('INSERT INTO admins VALUES(?,?)').run('owner', 'synthetic-hash');
    const setup = await beginMfa(f.database, 'owner');
    assert.ok(!(await mfaState(f.database, 'owner'))!.secret.includes(setup.secret));
    const code = totp(setup.secret, Math.floor(Date.now() / 30000));
    const recovery = await confirmMfa(f.database, 'owner', code);
    assert.equal(recovery?.length, 8);
    assert.equal(await verifyMfa(f.database, 'owner', code), false);
    const results = await Promise.all([
      verifyMfa(f.database, 'owner', recovery![0]),
      verifyMfa(f.database, 'owner', recovery![0]),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await verifyMfa(f.database, 'owner', '0000000000000000'), false);
  } finally {
    await f.close();
  }
});
test('MFA API rejects anonymous/CSRF access, rotates sessions and requires a code at login', async () => {
  const f = await fixture(),
    origin = 'http://localhost:3001';
  try {
    f.database.db
      .prepare('INSERT INTO admins VALUES(?,?)')
      .run('owner', await passwordHash('synthetic-password-long'));
    const api = createApi(f.database);
    let cookie = '',
      csrf = '';
    const call = (url: string, method = 'GET', body?: unknown, headers = {}) =>
      api(
        new Request(origin + url, {
          method,
          headers: {
            origin,
            cookie,
            'x-csrf-token': csrf,
            'content-type': 'application/json',
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
    assert.equal((await call('/api/admin/mfa')).status, 401);
    const login = await call('/api/login', 'POST', {
      username: 'owner',
      password: 'synthetic-password-long',
    });
    cookie = login.headers.get('set-cookie')!.split(';')[0];
    csrf = (await login.json()).csrf;
    assert.equal(
      (
        await call(
          '/api/admin/mfa',
          'POST',
          { action: 'begin', password: 'synthetic-password-long' },
          { 'x-csrf-token': 'wrong' },
        )
      ).status,
      403,
    );
    const setup = await (
      await call('/api/admin/mfa', 'POST', { action: 'begin', password: 'synthetic-password-long' })
    ).json();
    const oldCookie = cookie;
    const confirm = await call('/api/admin/mfa', 'POST', {
      action: 'confirm',
      code: totp(setup.secret, Math.floor(Date.now() / 30000)),
    });
    assert.equal(confirm.status, 200);
    const result = await confirm.json();
    cookie = confirm.headers.get('set-cookie')!.split(';')[0];
    csrf = result.csrf;
    assert.notEqual(cookie, oldCookie);
    assert.equal(
      (await call('/api/admin/mfa', 'GET', undefined, { cookie: oldCookie })).status,
      401,
    );
    assert.equal(
      (await call('/api/login', 'POST', { username: 'owner', password: 'synthetic-password-long' }))
        .status,
      401,
    );
    assert.equal(
      (
        await call('/api/login', 'POST', {
          username: 'owner',
          password: 'synthetic-password-long',
          code: result.recoveryCodes[0],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call('/api/login', 'POST', {
          username: 'owner',
          password: 'synthetic-password-long',
          code: result.recoveryCodes[0],
        })
      ).status,
      401,
    );
  } finally {
    await f.close();
  }
});
test('Encrypted backups restore complete history to an empty target and reject tampering/wrong keys', async () => {
  const source = await fixture(),
    target = await fixture();
  try {
    source.database.db.prepare('INSERT INTO admins VALUES(?,?)').run('owner', 'synthetic-hash');
    source.database.db
      .prepare('INSERT INTO messages(name,email,subject,message,created_at) VALUES(?,?,?,?,?)')
      .run('Test', 'test@example.com', 'Test', 'Preserve me', '2020-01-01');
    const key = 'ab'.repeat(32),
      snapshot = await captureBackup(source.database.db, 'bc'.repeat(32));
    const encrypted = encryptBackup(snapshot, key);
    assert.ok(!encrypted.includes(Buffer.from('Preserve me')));
    assert.throws(() => decryptBackup(encrypted, 'cd'.repeat(32)));
    const corrupted = Buffer.from(encrypted);
    corrupted[corrupted.length - 1] ^= 1;
    assert.throws(() => decryptBackup(corrupted, key));
    target.database.db.exec('DELETE FROM content');
    await restoreBackup(target.database.db, decryptBackup(encrypted, key));
    assert.equal(target.database.read().version, source.database.read().version);
    assert.equal(
      target.database.db.prepare('SELECT message FROM messages').get()!.message,
      'Preserve me',
    );
    await assert.rejects(restoreBackup(target.database.db, snapshot), /empty/);
  } finally {
    await source.close();
    await target.close();
  }
});
test('Responsive WebP revalidates publication before cached pixels or HTTP 304', async () => {
  const f = await fixture();
  try {
    const bytes = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: '#4264da' },
    })
      .png()
      .toBuffer();
    const url = await storeUpload(f.directory, bytes, 'image/png');
    const state = f.database.read();
    state.data.profile.cover = url;
    f.database.write(state.data, state.version);
    const request = new Request('http://localhost:3001' + url + '?w=320');
    const first = await uploadResponse(f.database, request, path.basename(url));
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'image/webp');
    assert.equal((await sharp(Buffer.from(await first.arrayBuffer())).metadata()).width, 320);
    const cached = new Request(request.url, {
      headers: { 'if-none-match': first.headers.get('etag')! },
    });
    assert.equal((await uploadResponse(f.database, cached, path.basename(url))).status, 304);
    const hidden = f.database.read();
    hidden.data.profile.cover = '';
    f.database.write(hidden.data, hidden.version);
    assert.equal((await uploadResponse(f.database, cached, path.basename(url))).status, 404);
  } finally {
    await f.close();
  }
});
test('Daily rollups retain old history and CSV exports remain bounded and formula-safe', async () => {
  const f = await fixture();
  try {
    const insert = f.database.db.prepare('INSERT INTO traffic_visits VALUES(?,?,?,?,?,?,?,?,?)');
    for (let i = 0; i < 401; i++)
      insert.run(
        String(i).padStart(4, '0'),
        'session',
        i === 0 ? '=malicious' : '/',
        Date.parse('2020-01-01T00:00:00Z') + i,
        '',
        'agent',
        'Chrome',
        'Desktop',
        'Windows',
      );
    await refreshTrafficDaily(f.database);
    assert.equal(
      Number(f.database.db.prepare('SELECT SUM(views) AS n FROM traffic_daily').get()!.n),
      401,
    );
    const csv = await new Response(trafficCsv(f.database, '')).text();
    assert.equal(csv.trim().split('\r\n').length, 402);
    assert.ok(csv.includes("'=malicious"));
  } finally {
    await f.close();
  }
});
