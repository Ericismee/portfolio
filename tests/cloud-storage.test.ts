import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createCloudDatabase, postgresParameters } from '../lib/cloud-database.ts';
import { startCloudUpload, consumeCloudUpload, type blobServices } from '../lib/cloud-uploads.ts';
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
    await assert.rejects(() => consumeCloudUpload(database, 'owner', intent.id, services), {
      status: 404,
    });
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
    await call('/api/admin/logout', 'POST');
    assert.equal((await call('/api/admin/content')).status, 401);
    assert.equal((await pg.query('SELECT count(*) AS count FROM rate_limits')).rows.length, 1);
  } finally {
    if (key === undefined) delete process.env.GITHUB_CREDENTIAL_KEY;
    else process.env.GITHUB_CREDENTIAL_KEY = key;
    await pg.close();
  }
});
