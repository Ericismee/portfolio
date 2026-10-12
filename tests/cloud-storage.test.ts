import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createCloudDatabase, postgresParameters } from '../lib/cloud-database.ts';
import {
  startCloudUpload,
  consumeCloudUpload,
  finishCloudUpload,
  type blobServices,
} from '../lib/cloud-uploads.ts';
import { createApi } from '../lib/api.ts';
import { passwordHash } from '../lib/auth.ts';
import { githubCredential, saveGithubCredential } from '../lib/github-connection.ts';
import { publicContent } from '../lib/schema.ts';
import { uploadExtension } from '../lib/uploads.ts';

test('Postgres persistence preserves authorization, atomic versions, rate limits and private upload ownership', async () => {
  const pg = new PGlite();
  // Run the production schema and statements on PostgreSQL, without cloud credentials.
  type Executor = {
    query(text: string, args?: unknown[]): Promise<{ rows: unknown[] }>;
    exec(text: string): Promise<unknown>;
  };
  const bridge = (executor: Executor): unknown =>
    Object.assign(
      async (strings: TemplateStringsArray, ...values: unknown[]) =>
        (
          await executor.query(
            strings.map((s, i) => s + (i < values.length ? '$' + (i + 1) : '')).join(''),
            values,
          )
        ).rows,
      {
        unsafe: async (text: string, args?: unknown[]) =>
          args ? (await executor.query(text, args)).rows : await executor.exec(text),
        begin: async (fn: (tx: unknown) => Promise<unknown>) =>
          pg.transaction((tx) => fn(bridge(tx))),
      },
    );
  const database = await createCloudDatabase(
    bridge(pg) as Parameters<typeof createCloudDatabase>[0],
  );
  const key = process.env.GITHUB_CREDENTIAL_KEY;
  process.env.GITHUB_CREDENTIAL_KEY = 'ab'.repeat(32);
  try {
    assert.equal(
      postgresParameters('SELECT * FROM content WHERE id=? AND version=?'),
      'SELECT * FROM content WHERE id=$1 AND version=$2',
    );
    await database.db
      .prepare('INSERT INTO admins VALUES(?,?)')
      .run('owner', await passwordHash('test-only-cloud-password'));
    const handle = createApi(database, true, 'https://profile.example');
    const login = await handle(
      new Request('https://profile.example/api/login', {
        method: 'POST',
        headers: { origin: 'https://profile.example', 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'test-only-cloud-password' }),
      }),
    );
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie')!, /HttpOnly.*Secure/);
    const { csrf } = await login.json();
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const call = (path: string, method = 'GET', body?: unknown) =>
      handle(
        new Request('https://profile.example' + path, {
          method,
          headers: {
            origin: 'https://profile.example',
            cookie,
            'x-csrf-token': csrf,
            'content-type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
    assert.equal(
      (await handle(new Request('https://profile.example/api/admin/content'))).status,
      401,
    );
    for (const route of ['upload-init', 'upload-finish', 'import-blob', 'content-blob']) {
      const rejected = await handle(
        new Request('https://profile.example/api/admin/' + route, {
          method: 'POST',
          headers: { origin: 'https://profile.example', 'content-type': 'application/json' },
          body: '{}',
        }),
      );
      assert.equal(rejected.status, 403, 'anonymous cloud mutations fail before storage access');
    }
    const state = await database.read();
    state.data.profile.summary = 'Cloud persistence test';
    const saved = await call('/api/admin/content', 'PUT', state);
    assert.equal(saved.status, 200);
    const next = await saved.json();
    assert.equal(next.version, state.version + 1);
    assert.equal((await call('/api/admin/content', 'PUT', state)).status, 409);
    assert.equal((await database.read()).version, next.version);
    assert.equal((await database.db.prepare('SELECT * FROM revisions').all()).length, 1);
    assert.equal(
      (await createCloudDatabase(bridge(pg) as Parameters<typeof createCloudDatabase>[0]))
        .read instanceof Function,
      true,
    );
    assert.equal(
      (await database.read()).data.profile.summary,
      'Cloud persistence test',
      'cold initialization never replaces content',
    );
    await saveGithubCredential(database, 'synthetic_cloud_token_never_real', 'owner');
    assert.equal((await githubCredential(database)).token, 'synthetic_cloud_token_never_real');
    const ciphertext = (await database.db
      .prepare('SELECT secret FROM github_connection')
      .get()) as { secret: string };
    assert(!ciphertext.secret.includes('synthetic_cloud_token'));
    assert(
      !JSON.stringify(publicContent((await database.read()).data)).includes(ciphertext.secret),
    );
    process.env.GITHUB_CREDENTIAL_KEY = 'cd'.repeat(32);
    await assert.rejects(() => githubCredential(database), { status: 503 });
    process.env.GITHUB_CREDENTIAL_KEY = 'ab'.repeat(32);
    const requests: string[] = [];
    const services: typeof blobServices = {
      generateToken: async (options) => {
        assert(options.pathname.startsWith('pending/'));
        assert.equal(options.allowOverwrite, false);
        assert.equal(options.maximumSizeInBytes, 5);
        return 'scoped-test-token';
      },
      get: async (pathname) => {
        requests.push(String(pathname));
        return {
          statusCode: 200,
          stream: new Response('%PDF-').body!,
          headers: new Headers(),
          blob: {
            url: '',
            downloadUrl: '',
            pathname: String(pathname),
            contentDisposition: '',
            cacheControl: '',
            uploadedAt: new Date(),
            etag: '',
            contentType: 'application/pdf',
            size: 5,
          },
        };
      },
      del: async () => undefined,
    };
    const intent = await startCloudUpload(
      database,
      'owner',
      { mime: 'application/pdf', size: 5 },
      services,
    );
    await assert.rejects(() => consumeCloudUpload(database, 'intruder', intent.id, services), {
      status: 404,
    });
    assert.equal(requests.length, 0);
    const file = await consumeCloudUpload(database, 'owner', intent.id, services);
    assert.equal(uploadExtension(file.bytes, file.mime), 'pdf');
    const copied: string[] = [];
    const finished = await startCloudUpload(
      database,
      'owner',
      { mime: 'application/pdf', size: 5 },
      services,
    );
    const resultUrl = await finishCloudUpload(
      database,
      'owner',
      finished.id,
      {
        ...services,
        del: async () => {
          assert.equal(copied.length, 1, 'staging is removed after the validated copy');
        },
      },
      async (source, destination, options) => {
        assert.equal(source, 'pending/' + finished.id);
        assert.equal(options.access, 'private');
        assert.equal(options.allowOverwrite, false);
        assert.equal(options.contentType, 'application/pdf');
        copied.push(destination);
        return {
          url: '',
          downloadUrl: '',
          pathname: destination,
          contentType: 'application/pdf',
          contentDisposition: '',
          etag: '',
        };
      },
    );
    assert.equal(resultUrl, '/' + copied[0]);
    // Streaming/compressed storage responses can omit the decoded byte length.
    // Unknown metadata must never bypass actual stream length validation.
    for (const [reportedSize, encoding, body, valid] of [
      [0, '', '%PDF-', true],
      [3, 'gzip', '%PDF-', true],
      [0, '', '%PDF', false],
      [0, '', '%PDF-extra', false],
      [3, 'gzip', '%PDF', false],
      [4, '', '%PDF-', false],
    ] as const) {
      const streamed = await startCloudUpload(
        database,
        'owner',
        { mime: 'application/pdf', size: 5 },
        services,
      );
      const task = consumeCloudUpload(database, 'owner', streamed.id, {
        ...services,
        get: async (pathname, options) => {
          const result = await services.get(pathname, options);
          if (result?.statusCode === 200) {
            result.blob.size = reportedSize;
            if (encoding) result.headers.set('content-encoding', encoding);
            result.stream = new Response(body).body!;
          }
          return result;
        },
      });
      if (valid) assert.equal((await task).bytes.toString(), body);
      else await assert.rejects(task, { status: body.length > 5 ? 413 : 400 });
    }
    const bad = await startCloudUpload(
      database,
      'owner',
      { mime: 'application/pdf', size: 5 },
      services,
    );
    await assert.rejects(
      () =>
        finishCloudUpload(
          database,
          'owner',
          bad.id,
          {
            ...services,
            get: async (pathname, options) => {
              const response = await services.get(pathname, options);
              if (response?.statusCode === 200) response.stream = new Response('wrong').body!;
              return response;
            },
          },
          async () => {
            throw Error('Unvalidated files must never be copied');
          },
        ),
      { status: 400 },
    );
    await assert.rejects(() => consumeCloudUpload(database, 'owner', intent.id, services), {
      status: 404,
    });
    const mismatch = await startCloudUpload(
      database,
      'owner',
      { mime: 'application/pdf', size: 5 },
      services,
    );
    await assert.rejects(
      () =>
        consumeCloudUpload(database, 'owner', mismatch.id, {
          ...services,
          get: async (pathname, options) => {
            const result = await services.get(pathname, options);
            if (result?.statusCode === 200) result.blob.contentType = 'text/html';
            return result;
          },
        }),
      { status: 400 },
    );
    const expired = await startCloudUpload(
      database,
      'owner',
      { mime: 'application/pdf', size: 5 },
      services,
    );
    await database.db
      .prepare('UPDATE upload_intents SET expires=? WHERE id=?')
      .run(Date.now() - 120_000, expired.id);
    const beforeExpired = requests.length;
    await assert.rejects(() => consumeCloudUpload(database, 'owner', expired.id, services), {
      status: 404,
    });
    assert.equal(requests.length, beforeExpired, 'expired tokens cannot read staged files');
    const removed: string[] = [];
    await startCloudUpload(
      database,
      'owner',
      { mime: 'application/pdf', size: 5 },
      {
        ...services,
        del: async (paths) => {
          removed.push(...(Array.isArray(paths) ? paths : [paths]));
        },
      },
    );
    assert(removed.includes('pending/' + expired.id));
    assert.equal(
      await database.db.prepare('SELECT id FROM upload_intents WHERE id=?').get(expired.id),
      undefined,
    );
    await assert.rejects(() =>
      startCloudUpload(database, 'owner', { mime: 'text/html', size: 5 }, services),
    );
    await assert.rejects(() =>
      startCloudUpload(
        database,
        'owner',
        { mime: 'application/pdf', size: 20 * 1024 * 1024 + 1 },
        services,
      ),
    );
    await assert.rejects(
      () => consumeCloudUpload(database, 'owner', 'https://attacker.example/file', services),
      { status: 400 },
    );
    const visit = await handle(
      new Request('https://profile.example/api/traffic', {
        method: 'POST',
        headers: {
          origin: 'https://profile.example',
          'content-type': 'application/json',
          'user-agent': 'Firefox/130.0',
        },
        body: JSON.stringify({ path: '/', durationTracking: true }),
      }),
    );
    assert.equal(visit.status, 200);
    const visitReceipt = await visit.json();
    assert.equal(visitReceipt.views, 1);
    await pg.query('UPDATE traffic_visits SET created_at=$1', [Date.now() - 120000]);
    const durationBody = {
      token: visitReceipt.trackingToken,
      instance: '12345678-1234-4234-8234-123456789abc',
      durationMs: 12345,
    };
    for (const durationMs of [12345, 1000]) {
      const durationResponse = await handle(
        new Request('https://profile.example/api/traffic/duration', {
          method: 'POST',
          headers: { origin: 'https://profile.example', 'content-type': 'application/json' },
          body: JSON.stringify({ ...durationBody, durationMs }),
        }),
      );
      assert.equal(durationResponse.status, 200);
    }
    const traffic = await (await call('/api/admin/traffic?q=firefox')).json();
    assert.equal(traffic.profileViews, 1);
    assert.equal(traffic.visits, 1);
    assert.equal(traffic.entries[0].browser, 'Firefox');
    assert.equal(traffic.entries[0].durationMs, 12345);
    assert.equal(traffic.total, 1);
    assert.equal(
      traffic.daily.reduce((sum: number, row: { views: number }) => sum + row.views, 0),
      1,
    );
    assert.deepEqual(traffic.countries, [{ country: 'unknown', views: 1, visits: 1 }]);
    assert.equal(traffic.filtered.pageViews, 1);
    assert.deepEqual(traffic.breakdowns.browser, [{ name: 'Firefox', views: 1 }]);
    await pg.query('UPDATE traffic_visits SET created_at=$1', [Date.now() - 400 * 86400000]);
    const historicalTraffic = await (await call('/api/admin/traffic')).json();
    assert.equal(historicalTraffic.total, 1);
    assert.equal(historicalTraffic.entries[0].browser, 'Firefox');
    const unknownTraffic = await (await call('/api/admin/traffic?country=unknown&path=%2F')).json();
    assert.equal(unknownTraffic.total, 1);
    assert.equal((await call('/api/admin/traffic?ip=invalid')).status, 400);
    await call('/api/admin/logout', 'POST');
    assert.equal((await call('/api/admin/content')).status, 401);
    assert.equal((await pg.query('SELECT count(*) AS count FROM rate_limits')).rows.length, 1);
    const accountLogin = await handle(
      new Request('https://profile.example/api/login', {
        method: 'POST',
        headers: { origin: 'https://profile.example', 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'test-only-cloud-password' }),
      }),
    );
    assert.equal(accountLogin.status, 200);
    const oldCookie = accountLogin.headers.get('set-cookie')!.split(';')[0];
    const accountCsrf = (await accountLogin.json()).csrf;
    await database.db
      .prepare('INSERT INTO upload_intents VALUES(?,?,?,?,?)')
      .run('account-upload', 'owner', 'application/pdf', 20, Date.now() + 10000);
    const changed = await handle(
      new Request('https://profile.example/api/admin/account', {
        method: 'PUT',
        headers: {
          origin: 'https://profile.example',
          'content-type': 'application/json',
          cookie: oldCookie,
          'x-csrf-token': accountCsrf,
        },
        body: JSON.stringify({
          username: 'cloud-owner',
          email: 'cloud-owner@example.test',
          currentPassword: 'test-only-cloud-password',
          newPassword: 'new-cloud-password-only',
          confirmPassword: 'new-cloud-password-only',
        }),
      }),
    );
    assert.equal(changed.status, 200);
    assert.match(changed.headers.get('set-cookie')!, /HttpOnly.*Secure/);
    assert.equal(
      (
        (await database.db
          .prepare('SELECT username FROM upload_intents WHERE id=?')
          .get('account-upload')) as { username: string }
      ).username,
      'cloud-owner',
    );
    assert.equal(
      await database.db.prepare('SELECT username FROM admins WHERE username=?').get('owner'),
      undefined,
    );
    const privateAccount = await handle(
      new Request('https://profile.example/api/admin/account', {
        headers: { cookie: changed.headers.get('set-cookie')!.split(';')[0] },
      }),
    );
    assert.deepEqual(await privateAccount.json(), {
      username: 'cloud-owner',
      email: 'cloud-owner@example.test',
    });
    assert.equal(
      (
        await handle(
          new Request('https://profile.example/api/admin/account', {
            headers: { cookie: oldCookie },
          }),
        )
      ).status,
      401,
    );
  } finally {
    if (key === undefined) delete process.env.GITHUB_CREDENTIAL_KEY;
    else process.env.GITHUB_CREDENTIAL_KEY = key;
    await pg.close();
  }
});
