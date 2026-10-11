import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../lib/database.ts';
import { createApi } from '../lib/api.ts';
import { passwordHash, verifyPassword } from '../lib/auth.ts';

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'profile-account-'));
  const database = openDatabase(directory),
    handle = createApi(database),
    origin = 'http://localhost:3001';
  const password = 'account-test-password-only';
  for (const name of ['owner', 'other'])
    database.db.prepare('INSERT INTO admins VALUES(?,?)').run(name, await passwordHash(password));
  const call = (url: string, method = 'GET', body?: unknown, headers = {}) =>
    handle(
      new Request(origin + url, {
        method,
        headers: { origin, 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const login = async (username = 'owner', pass = password) => {
    const response = await call('/api/login', 'POST', { username, password: pass });
    const data = await response.json();
    return {
      response,
      csrf: data.csrf as string,
      cookie: response.headers.get('set-cookie')?.split(';')[0] || '',
    };
  };
  const cleanup = async () => {
    database.db.close();
    await rm(directory, { recursive: true, force: true });
  };
  return { database, call, login, password, cleanup };
}
test('Account changes require a session, CSRF, current password and valid non-duplicate credentials', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/api/admin/account')).status, 401);
    assert.equal((await f.call('/api/admin/account', 'PUT', {})).status, 403);
    const session = await f.login(),
      headers = { cookie: session.cookie, 'x-csrf-token': session.csrf };
    const input = {
      username: 'owner',
      email: 'owner@example.test',
      currentPassword: f.password,
      newPassword: '',
      confirmPassword: '',
    };
    assert.equal(
      (await f.call('/api/admin/account', 'PUT', input, { cookie: session.cookie })).status,
      403,
    );
    assert.equal(
      (
        await f.call(
          '/api/admin/account',
          'PUT',
          { ...input, currentPassword: 'incorrect' },
          headers,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await f.call(
          '/api/admin/account',
          'PUT',
          { ...input, newPassword: 'short', confirmPassword: 'short' },
          headers,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await f.call(
          '/api/admin/account',
          'PUT',
          { ...input, newPassword: 'valid-new-password', confirmPassword: 'different' },
          headers,
        )
      ).status,
      400,
    );
    assert.equal(
      (await f.call('/api/admin/account', 'PUT', { ...input, email: 'invalid' }, headers)).status,
      400,
    );
    assert.equal(
      (await f.call('/api/admin/account', 'PUT', { ...input, username: 'OTHER' }, headers)).status,
      409,
    );
    assert.deepEqual(await (await f.call('/api/admin/account', 'GET', undefined, headers)).json(), {
      username: 'owner',
      email: '',
    });
    assert.equal((await f.login()).response.status, 200);
  } finally {
    await f.cleanup();
  }
});
test('Rename and password change rotate every owner session, preserve other admins and keep email private', async () => {
  const f = await fixture();
  try {
    const first = await f.login(),
      second = await f.login(),
      other = await f.login('other');
    const before = f.database.read();
    const response = await f.call(
      '/api/admin/account',
      'PUT',
      {
        username: 'eric-new',
        email: 'private-admin@example.test',
        currentPassword: f.password,
        newPassword: 'new-account-password-only',
        confirmPassword: 'new-account-password-only',
      },
      { cookie: first.cookie, 'x-csrf-token': first.csrf },
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(Object.keys(result).sort(), ['csrf', 'email', 'username']);
    assert.notEqual(result.csrf, first.csrf);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.notEqual(cookie, first.cookie);
    for (const old of [first, second])
      assert.equal(
        (await f.call('/api/admin/account', 'GET', undefined, { cookie: old.cookie })).status,
        401,
      );
    assert.equal(
      (await f.call('/api/admin/account', 'GET', undefined, { cookie: other.cookie })).status,
      200,
    );
    assert.deepEqual(
      await (await f.call('/api/admin/account', 'GET', undefined, { cookie })).json(),
      { username: 'eric-new', email: 'private-admin@example.test' },
    );
    assert.equal((await f.login('owner')).response.status, 401);
    assert.equal((await f.login('eric-new', f.password)).response.status, 401);
    assert.equal((await f.login('eric-new', 'new-account-password-only')).response.status, 200);
    const row = f.database.db
      .prepare('SELECT password_hash FROM admins WHERE username=?')
      .get('eric-new') as { password_hash: string };
    assert.ok(await verifyPassword('new-account-password-only', row.password_hash));
    assert.notEqual(row.password_hash, 'new-account-password-only');
    assert.deepEqual(f.database.read(), before);
    assert.ok(
      !(await (await f.call('/api/content')).text()).includes('private-admin@example.test'),
    );
    const updated = await f.call(
      '/api/admin/account',
      'PUT',
      {
        username: 'eric-new',
        email: 'changed@example.test',
        currentPassword: 'new-account-password-only',
        newPassword: '',
        confirmPassword: '',
      },
      { cookie, 'x-csrf-token': result.csrf },
    );
    assert.equal(updated.status, 200);
    assert.equal(
      (
        f.database.db
          .prepare('SELECT password_hash FROM admins WHERE username=?')
          .get('eric-new') as { password_hash: string }
      ).password_hash,
      row.password_hash,
    );
  } finally {
    await f.cleanup();
  }
});
test('Account reauthentication is rate limited and stale updates cannot overwrite newer credentials', async () => {
  const f = await fixture();
  try {
    const session = await f.login(),
      headers = { cookie: session.cookie, 'x-csrf-token': session.csrf };
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await f.call(
            '/api/admin/account',
            'PUT',
            {
              username: 'owner',
              email: '',
              currentPassword: 'wrong',
              newPassword: '',
              confirmPassword: '',
            },
            headers,
          )
        ).status,
        400,
      );
    assert.equal(
      (
        await f.call(
          '/api/admin/account',
          'PUT',
          {
            username: 'owner',
            email: '',
            currentPassword: f.password,
            newPassword: '',
            confirmPassword: '',
          },
          headers,
        )
      ).status,
      429,
    );
    assert.throws(
      () =>
        f.database.changeAccount({
          current: 'owner',
          sessionHash: 'invalid',
          username: 'owner',
          email: '',
          expectedHash: 'stale',
          passwordHash: 'stale',
        }),
      { status: 409 },
    );
    assert.equal((await f.call('/api/admin/account', 'GET', undefined, headers)).status, 200);
  } finally {
    await f.cleanup();
  }
});
