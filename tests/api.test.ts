import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, HttpError } from '../lib/database.ts';
import { uploadResponse } from '../lib/upload-response.ts';
import { storeUpload } from '../lib/uploads.ts';
import { createApi } from '../lib/api.ts';
import { passwordHash } from '../lib/auth.ts';
import { githubCredential } from '../lib/github-connection.ts';
import { type ContentState, publicContent, contentSchema } from '../lib/schema.ts';

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'eric-profile-test-'));
  const database = openDatabase(directory),
    handle = createApi(database),
    origin = 'http://localhost:3001';
  database.db
    .prepare('INSERT INTO admins VALUES(?,?)')
    .run('admin', await passwordHash('test-password-never-production'));
  let cookie = '',
    csrf = '';
  async function call(
    url: string,
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const response = await handle(
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
    const data = await response.json();
    return { response, data };
  }
  async function login() {
    const result = await call('/api/login', 'POST', {
      username: 'admin',
      password: 'test-password-never-production',
    });
    assert.equal(result.response.status, 200);
    cookie = result.response.headers.get('set-cookie')!.split(';')[0];
    csrf = result.data.csrf;
    return { cookie, csrf };
  }
  const cleanup = async () => {
    database.db.close();
    await rm(directory, { recursive: true, force: true });
  };
  return { database, handle, origin, call, login, cleanup, directory };
}

test('Admin GitHub connection validates credentials, encrypts secrets, protects private imports and supports disconnect', async () => {
  const f = await fixture(),
    original = globalThis.fetch;
  const token = 'github_pat_qa_connection_secret_123456789';
  let repositoryCalls = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer ' + token);
    const address = String(input);
    if (address.endsWith('/user'))
      return Response.json(
        { login: 'qa-connected' },
        { headers: { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4999' } },
      );
    if (address.includes('/user/repos?')) {
      repositoryCalls++;
      return Response.json([
        {
          name: 'private-repo',
          full_name: 'qa-connected/private-repo',
          private: true,
          language: 'Rust',
          fork: false,
        },
      ]);
    }
    if (/\/(languages|readme|contents\/package.json)$/.test(address))
      return Response.json({}, { status: 404 });
    return Response.json({
      name: 'private-repo',
      description: 'Private description',
      language: 'Rust',
      private: true,
      fork: false,
      archived: false,
      owner: { login: 'qa-connected', type: 'User' },
    });
  };
  try {
    assert.equal((await f.call('/api/admin/github-connection')).response.status, 401);
    assert.equal((await f.call('/api/admin/github-repositories')).response.status, 401);
    await f.login();
    assert.equal(
      (
        await f.call(
          '/api/admin/github-connection',
          'POST',
          { token },
          { 'x-csrf-token': 'invalid' },
        )
      ).response.status,
      403,
    );
    const before = f.database.read();
    const connected = await f.call('/api/admin/github-connection', 'POST', { token });
    assert.equal(connected.data.login, 'qa-connected');
    assert.equal(connected.data.remaining, 4999);
    assert.ok(!JSON.stringify(connected.data).includes(token));
    assert.equal((await githubCredential(f.database)).token, token);
    const stored = f.database.db.prepare('SELECT secret FROM github_connection').get() as {
      secret: string;
    };
    assert.ok(!stored.secret.includes(token));
    assert.deepEqual(f.database.read(), before, 'connection does not change content or revisions');
    const listed = await f.call('/api/admin/github-repositories');
    assert.equal(listed.data.repos[0].private, true);
    await f.call('/api/admin/github-repositories');
    assert.equal(repositoryCalls, 1, 'repository list reuses authenticated cache');
    const detail = await f.call(
      '/api/admin/github-project?username=qa-connected&repo=private-repo',
    );
    assert.equal(detail.response.status, 200);
    assert.equal(detail.data.private, true);
    const publicData = await f.call('/api/content');
    assert.ok(!JSON.stringify(publicData.data).includes('Private description'));
    assert.ok(!JSON.stringify(publicData.data).includes(token));
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    assert.equal(
      (
        await f.call('/api/admin/github-connection', 'POST', {
          token: 'github_pat_invalid_token_123456',
        })
      ).response.status,
      400,
    );
    assert.equal(
      (await githubCredential(f.database)).token,
      token,
      'invalid replacement retains working connection',
    );
    await f.call('/api/admin/github-connection', 'DELETE');
    assert.notEqual((await githubCredential(f.database)).token, token);
    globalThis.fetch = async () => Response.json({}, { status: 404 });
    assert.equal(
      (await f.call('/api/admin/github-project?username=qa-connected&repo=private-repo')).response
        .status,
      404,
      'disconnect cannot reuse private authenticated detail cache',
    );
  } finally {
    globalThis.fetch = original;
    await f.cleanup();
  }
});
test('Production login requires the configured origin and retains secure session cookies', async () => {
  const f = await fixture();
  try {
    const request = (origin: string) =>
      new Request(f.origin + '/api/login', {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'test-password-never-production',
        }),
      });
    const missing = await createApi(f.database, true)(request(f.origin));
    assert.equal(missing.status, 503);
    const handle = createApi(f.database, true, f.origin);
    assert.equal((await handle(request('https://attacker.test'))).status, 403);
    const login = await handle(request(f.origin));
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie')!, /^__Host-profile_session=/);
    assert.match(login.headers.get('set-cookie')!, /; Secure/);
  } finally {
    await f.cleanup();
  }
});

test('Server authorization, CSRF, session logout and invalid credentials', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/api/admin/content')).response.status, 401);
    assert.equal((await f.call('/api/admin/content', 'PUT', {})).response.status, 403);
    assert.equal(
      (await f.call('/api/login', 'POST', { username: 'admin', password: 'incorrect' })).response
        .status,
      401,
    );
    const session = await f.login();
    assert.match(session.cookie, /profile_session=/);
    const { data: state } = await f.call('/api/admin/content');
    assert.equal(
      (await f.call('/api/admin/content', 'PUT', state, { 'x-csrf-token': 'invalid' })).response
        .status,
      403,
    );
    assert.equal(
      (await f.call('/api/admin/content', 'PUT', state, { origin: 'https://attacker.test' }))
        .response.status,
      403,
    );
    assert.equal((await f.call('/api/admin/logout', 'POST', {})).response.status, 200);
    assert.equal((await f.call('/api/admin/content')).response.status, 401);
  } finally {
    await f.cleanup();
  }
});
test('CRUD, scheduling, hide, reorder, conflicts, recovery and persistence', async () => {
  const f = await fixture();
  try {
    await f.login();
    let state = (await f.call('/api/admin/content')).data as ContentState;
    state.data.posts = contentSchema.parse({
      ...state.data,
      posts: [
        {
          id: 'draft',
          title: 'Secret draft',
          text: 'Private text',
          type: 'Bài viết',
          visibility: 'draft',
        },
        {
          id: 'live',
          title: 'Published',
          text: 'Public text',
          type: 'Bài viết',
          visibility: 'public',
          displayAt: new Date().toISOString(),
        },
        {
          id: 'later',
          title: 'Scheduled',
          text: 'Not yet',
          type: 'Bài viết',
          visibility: 'public',
          displayAt: '2099-01-01T00:00:00Z',
        },
      ],
    }).posts;
    const first = await f.call('/api/admin/content', 'PUT', state);
    assert.equal(first.response.status, 200);
    state = first.data;
    assert.deepEqual(
      (await f.call('/api/content')).data.data.posts.map((p: { id: string }) => p.id),
      ['live'],
    );
    assert.equal(
      (await f.call('/api/admin/content', 'PUT', { ...state, version: 1 })).response.status,
      409,
    );
    state.data.posts[0].visibility = 'public';
    state.data.posts[1].visible = false;
    state.data.projects.reverse();
    state.data.hidden.push('Giới thiệu');
    state.data.sectionTitles['Dự án'] = 'Selected work';
    const before = state.data.projects.map((p) => p.id);
    state = (await f.call('/api/admin/content', 'PUT', state)).data;
    const visible = (await f.call('/api/content')).data.data;
    assert.deepEqual(
      visible.posts.map((p: { id: string }) => p.id),
      ['draft'],
    );
    assert.equal(visible.profile.about, '');
    assert.deepEqual(
      visible.projects.map((p: { id: string }) => p.id),
      before,
    );
    assert.equal(visible.sectionTitles['Dự án'], 'Selected work');
    state.data.trash = [
      {
        id: 'trash-1',
        kind: 'posts',
        section: '',
        deletedAt: new Date().toISOString(),
        value: state.data.posts[0],
      },
    ];
    state.data.posts.splice(0, 1);
    state = (await f.call('/api/admin/content', 'PUT', state)).data;
    assert.equal((await f.call('/api/content')).data.data.posts.length, 0);
    state.data.posts.push({
      ...(state.data.trash[0].value as (typeof state.data.posts)[0]),
      visibility: 'draft',
    });
    state.data.trash = [];
    state = (await f.call('/api/admin/content', 'PUT', state)).data;
    assert.equal(state.data.posts.at(-1)!.visibility, 'draft');
    const revisions = (await f.call('/api/admin/revisions')).data.revisions;
    assert.equal(revisions.length, 4);
    state = (
      await f.call('/api/admin/restore', 'POST', {
        id: revisions.at(-1).id,
        version: state.version,
      })
    ).data;
    assert.equal(state.data.posts.length, 2);
    assert.ok(state.data.posts.every((post) => post.visibility === 'draft'));
    // A second connection reads the committed data, independent of browser state.
    const reopened = openDatabase(f.directory);
    assert.deepEqual(reopened.read(), state);
    reopened.db.close();
  } finally {
    await f.cleanup();
  }
});
test('Custom sections, safe input and contact inbox', async () => {
  const f = await fixture();
  try {
    await f.login();
    let state = (await f.call('/api/admin/content')).data as ContentState;
    state.data.sections.unshift('Talks');
    state.data.items.Talks = [
      {
        id: 'talk-1',
        title: 'Typed web apps',
        organization: 'Community',
        period: '2026',
        description: 'A short talk',
        link: '',
        image: '',
        file: '',
        visible: true,
        visibility: 'public',
      },
    ];
    state = (await f.call('/api/admin/content', 'PUT', state)).data;
    assert.equal((await f.call('/api/content')).data.data.items.Talks.length, 1);
    state.data.hidden.push('Talks');
    state = (await f.call('/api/admin/content', 'PUT', state)).data;
    assert.equal((await f.call('/api/content')).data.data.items.Talks, undefined);
    const bad = structuredClone(state);
    bad.data.profile.avatar = 'javascript:alert(1)';
    assert.equal((await f.call('/api/admin/content', 'PUT', bad)).response.status, 400);
    assert.equal(
      (
        await f.call('/api/contact', 'POST', {
          name: 'Visitor',
          email: 'invalid',
          subject: 'Hello',
          message: 'Valid message',
        })
      ).response.status,
      400,
    );
    assert.equal(
      (
        await f.call('/api/contact', 'POST', {
          name: 'Visitor',
          email: 'visitor@example.com',
          subject: 'Hello',
          message: 'A real message for the owner',
        })
      ).response.status,
      201,
    );
    const inbox = (await f.call('/api/admin/messages')).data.messages;
    assert.equal(inbox.length, 1);
    await f.call('/api/admin/messages', 'DELETE', { id: inbox[0].id });
    assert.equal((await f.call('/api/admin/messages')).data.messages.length, 0);
  } finally {
    await f.cleanup();
  }
});
test('Contact accepts short and long messages without character-count limits', async () => {
  const f = await fixture();
  try {
    await f.login();
    for (const message of ['Hi', 'Nội dung dài '.repeat(2000)]) {
      assert.equal(
        (
          await f.call('/api/contact', 'POST', {
            name: 'Visitor',
            email: 'visitor@example.com',
            subject: 'Hợp tác',
            message,
          })
        ).response.status,
        201,
      );
    }
    assert.equal(
      (
        await f.call('/api/contact', 'POST', {
          name: 'Visitor',
          email: 'visitor@example.com',
          subject: 'Trao đổi',
          message: '   ',
        })
      ).response.status,
      400,
    );
    const messages = (await f.call('/api/admin/messages')).data.messages;
    assert.equal(messages.length, 2);
    assert.ok(messages.some((m: { message: string }) => m.message.length > 10000));
  } finally {
    await f.cleanup();
  }
});

test('Uploads validate signatures and imports preserve embedded assets', async () => {
  const f = await fixture();
  try {
    const { cookie, csrf } = await f.login(),
      url = f.origin + '/api/admin/upload';
    const invalid = await f.handle(
      new Request(url, {
        method: 'POST',
        headers: { origin: f.origin, cookie, 'x-csrf-token': csrf, 'content-type': 'image/png' },
        body: 'not an image',
      }),
    );
    assert.equal(invalid.status, 400);
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    const uploaded = await f.handle(
      new Request(url, {
        method: 'POST',
        headers: { origin: f.origin, cookie, 'x-csrf-token': csrf, 'content-type': 'image/png' },
        body: Buffer.from(png, 'base64'),
      }),
    );
    assert.equal(uploaded.status, 201);
    const imageUrl = (await uploaded.json()).url;
    assert.match(imageUrl, /^\/uploads\/.*\.png$/);
    assert.deepEqual(
      await readFile(path.join(f.directory, imageUrl)),
      Buffer.from(png, 'base64'),
      'Uploads preserve the original bytes without resizing or converting',
    );
    const state = (await f.call('/api/admin/content')).data as ContentState;
    state.data.profile.avatar = 'data:image/png;base64,' + png;
    const imported = await f.call('/api/admin/import', 'POST', state);
    assert.equal(imported.response.status, 200);
    assert.match(imported.data.data.profile.avatar, /^\/uploads\//);
    const publicView = publicContent(imported.data.data);
    assert.deepEqual(publicView.trash, []);
  } finally {
    await f.cleanup();
  }
});

test('Appearance and logo save together, and stale saves retain HTTP 409 after module reload', async () => {
  const f = await fixture();
  try {
    await f.login();
    const state = (await f.call('/api/admin/content')).data as ContentState;
    assert.equal(state.data.profile.logo, '');
    assert.equal(
      state.data.showVisitorCount,
      true,
      'existing profiles keep the counter by default',
    );
    state.data.profile.logo = '/uploads/1234-abcd.png';
    state.data.theme = 'dark';
    state.data.showVisitorCount = false;
    state.data.density = 'compact';
    state.data.layout = 'wide';
    const saved = await f.call('/api/admin/content', 'PUT', state);
    assert.equal(saved.response.status, 200);
    assert.equal(saved.data.data.profile.logo, state.data.profile.logo);
    assert.equal(publicContent(f.database.read().data).profile.logo, state.data.profile.logo);
    assert.equal(f.database.read().data.theme, 'dark');
    assert.equal((await f.call('/api/content')).data.data.showVisitorCount, false);
    assert.equal((await f.call('/api/admin/content', 'PUT', state)).response.status, 409);
    // Recreate the constructor mismatch produced by development hot reload.
    const reloaded = await import(new URL('../lib/database.ts?reload-test', import.meta.url).href);
    const conflict = new reloaded.HttpError(409, 'Reload before saving');
    assert.equal(conflict instanceof HttpError, false);
    f.database.write = () => {
      throw conflict;
    };
    const stale = await f.call('/api/admin/content', 'PUT', state);
    assert.equal(stale.response.status, 409);
    assert.equal(stale.data.error, 'Reload before saving');
    const refreshed = openDatabase(f.directory, f.database.db);
    assert.equal(refreshed.read().data.profile.logo, state.data.profile.logo);
    assert.equal(
      refreshed.read().data.showVisitorCount,
      false,
      'counter visibility persists across database reload',
    );
    assert.equal(f.database.read().data.profile.logo, state.data.profile.logo);
    const latest = refreshed.read();
    refreshed.write(latest.data, latest.version);
    assert.equal(f.database.read().version, latest.version + 1);
  } finally {
    await f.cleanup();
  }
});

test('Failed imports and restores leave authored data intact; revision retention stays bounded', async () => {
  const f = await fixture();
  try {
    await f.login();
    let state = f.database.read();
    const invalid = structuredClone(state);
    invalid.data.skills = Array.from({ length: 61 }, (_, i) => 'Skill ' + i);
    assert.equal((await f.call('/api/admin/import', 'POST', invalid)).response.status, 400);
    assert.equal(
      (await f.call('/api/admin/restore', 'POST', { id: 99999, version: state.version })).response
        .status,
      404,
    );
    assert.deepEqual(f.database.read(), state);
    for (let i = 0; i < 35; i++) {
      state.data.profile.summary = 'Revision ' + i;
      const saved = await f.call('/api/admin/content', 'PUT', state);
      assert.equal(saved.response.status, 200);
      state = saved.data;
    }
    const history = (await f.call('/api/admin/revisions')).data.revisions;
    assert.equal(history.length, 30);
    const restored = await f.call('/api/admin/restore', 'POST', {
      id: history[0].id,
      version: state.version,
    });
    assert.equal(restored.response.status, 200);
    assert.equal(restored.data.data.profile.summary, 'Revision 33');
    f.database.db.prepare('UPDATE sessions SET expires=0').run();
    assert.equal((await f.call('/api/admin/content')).response.status, 401);
    assert.equal((await f.call('/api/admin/content', 'PUT', state)).response.status, 403);
  } finally {
    await f.cleanup();
  }
});

test('Original GIF and PDF uploads retain bytes; oversized files are rejected without content changes', async () => {
  const f = await fixture();
  try {
    const { cookie, csrf } = await f.login();
    const before = f.database.read();
    const upload = (body: Buffer, mime: string) =>
      f.handle(
        new Request(f.origin + '/api/admin/upload', {
          method: 'POST',
          headers: { origin: f.origin, cookie, 'x-csrf-token': csrf, 'content-type': mime },
          body: new Uint8Array(body),
        }),
      );
    for (const [body, mime] of [
      [Buffer.from('GIF89a original animation bytes'), 'image/gif'],
      [Buffer.from('%PDF-1.7 original CV bytes'), 'application/pdf'],
    ] as const) {
      const response = await upload(body, mime);
      assert.equal(response.status, 201);
      const { url } = await response.json();
      assert.deepEqual(await readFile(path.join(f.directory, url)), body);
    }
    const boundary = Buffer.alloc(20 * 1024 * 1024);
    boundary.write('%PDF-');
    assert.equal((await upload(boundary, 'application/pdf')).status, 201);
    boundary.write('GIF89a');
    assert.equal((await upload(boundary, 'image/gif')).status, 201);
    const large = Buffer.alloc(20 * 1024 * 1024 + 1);
    large.write('GIF89a');
    assert.equal((await upload(large, 'image/gif')).status, 413);
    const pdf = Buffer.alloc(20 * 1024 * 1024 + 1);
    pdf.write('%PDF-');
    assert.equal((await upload(pdf, 'application/pdf')).status, 413);
    assert.deepEqual(f.database.read(), before);
  } finally {
    await f.cleanup();
  }
});

test('GitHub configuration requires admin authorization and survives saving and database reload', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/api/admin/github')).response.status, 401);
    assert.equal(
      (await f.call('/api/admin/github-project?username=qa&repo=test')).response.status,
      401,
    );
    await f.login();
    assert.equal(
      (await f.call('/api/admin/github-project?username=qa&repo=..')).response.status,
      400,
    );
    assert.equal((await f.call('/api/admin/github?username=../invalid')).response.status, 400);
    const emptyAccount = await f.call('/api/admin/github?username=');
    assert.equal(emptyAccount.response.status, 200);
    assert.equal(emptyAccount.data.status, 'empty');
    const state = (await f.call('/api/admin/content')).data as ContentState;
    assert.equal(state.data.github.refreshMinutes, 60);
    state.data.github.hiddenRepos = ['horune'];
    state.data.github.featuredMode = 'selected';
    state.data.github.featuredRepos = ['LingoraAI', 'horune'];
    state.data.github.showCalendar = false;
    state.data.github.title = 'Dự án đang xây dựng';
    assert.equal(
      (await f.call('/api/admin/content', 'PUT', state, { 'x-csrf-token': 'wrong' })).response
        .status,
      403,
    );
    assert.equal((await f.call('/api/admin/content', 'PUT', state)).response.status, 200);
    const next = openDatabase(f.directory);
    try {
      assert.deepEqual(next.read().data.github, state.data.github);
    } finally {
      next.db.close();
    }
    const publicState = (await f.call('/api/content')).data.data;
    assert.deepEqual(publicState.github.hiddenRepos, []);
    assert.deepEqual(publicState.github.featuredRepos, ['LingoraAI']);
    assert.equal(publicState.github.showCalendar, false);
    assert.equal(publicState.github.title, 'Dự án đang xây dựng');
  } finally {
    await f.cleanup();
  }
});

test('Private section names, drafts, schedules and deleted entries never reach public JSON', async () => {
  const f = await fixture();
  try {
    const state = f.database.read();
    const marker = 'QA_CONFIDENTIAL_7a01';
    state.data.sections.push(marker);
    state.data.hidden.push(marker);
    state.data.sectionTitles[marker] = marker + '_title';
    state.data.items[marker] = [
      {
        id: 'private-section-item',
        title: marker,
        organization: '',
        period: '',
        description: marker,
        link: '',
        image: '',
        file: '',
        visible: true,
        visibility: 'public',
      },
    ];
    state.data.posts = [
      { id: 'draft', title: marker + '_draft', text: marker, visibility: 'draft' },
      {
        id: 'hidden',
        title: marker + '_hidden',
        text: marker,
        visibility: 'public',
        visible: false,
      },
      {
        id: 'future',
        title: marker + '_future',
        text: marker,
        visibility: 'public',
        displayAt: '2099-01-01T00:00:00Z',
      },
    ].map((p) => contentSchema.shape.posts.element.parse(p));
    state.data.trash = [
      {
        id: 'deleted',
        kind: 'posts',
        section: '',
        deletedAt: new Date().toISOString(),
        value: state.data.posts[0],
      },
    ];
    f.database.write(state.data, state.version);
    const response = await f.call('/api/content');
    assert.equal(response.response.status, 200);
    assert(!JSON.stringify(response.data).includes(marker));
    assert.equal(response.response.headers.get('cache-control'), 'no-store');
    assert(f.database.read().data.sections.includes(marker));
    assert(contentSchema.safeParse(response.data.data).success);
  } finally {
    await f.cleanup();
  }
});

test('Every private read endpoint rejects anonymous and forged sessions without exposing data', async () => {
  const f = await fixture();
  try {
    for (const endpoint of [
      '/api/admin/content',
      '/api/admin/revisions',
      '/api/admin/messages',
      '/api/admin/github',
      '/api/admin/github-connection',
      '/api/admin/github-repositories',
      '/api/admin/github-project?username=qa&repo=test',
    ]) {
      for (const cookie of ['', 'profile_session=forged']) {
        const result = await f.call(endpoint, 'GET', undefined, { cookie });
        assert.equal(result.response.status, 401, endpoint);
        assert.deepEqual(Object.keys(result.data), ['error']);
        assert.equal(result.response.headers.get('cache-control'), 'no-store');
      }
    }
  } finally {
    await f.cleanup();
  }
});

test('Uploads enforce publication and session access, revoke access immediately and reject traversal', async () => {
  const f = await fixture();
  try {
    const url = await storeUpload(
      f.directory,
      Buffer.from('%PDF-1.7 QA private document'),
      'application/pdf',
    );
    const filename = url.split('/').pop()!;
    const get = (cookie = '', suffix = '', name = filename) =>
      uploadResponse(
        f.database,
        new Request(f.origin + url + suffix, { headers: { cookie } }),
        name,
      );
    assert.equal((await get()).status, 404);
    assert.equal((await get('profile_session=forged')).status, 404);
    const { cookie } = await f.login();
    assert.equal((await get(cookie)).status, 200);
    let state = f.database.read();
    state.data.posts = [
      contentSchema.shape.posts.element.parse({
        id: 'private-file',
        title: 'QA file',
        image: url,
        visibility: 'draft',
      }),
    ];
    f.database.write(state.data, state.version);
    assert.equal((await get()).status, 404);
    state = f.database.read();
    state.data.posts[0].visibility = 'public';
    state.data.posts[0].image = '';
    state.data.posts[0].markdown = '[Read document](' + url + ')';
    state.data.posts[0].bodyFormat = 'markdown';
    f.database.write(state.data, state.version);
    const published = await get();
    assert.equal(published.status, 200);
    assert.equal(published.headers.get('cache-control'), 'private, no-store');
    assert.equal(published.headers.get('content-type'), 'application/pdf');
    assert.match(
      (await get('', '?download=1')).headers.get('content-disposition')!,
      /^attachment;/,
    );
    state = f.database.read();
    state.data.posts[0].visible = false;
    f.database.write(state.data, state.version);
    assert.equal((await get()).status, 404);
    assert.equal((await f.call('/api/admin/logout', 'POST')).response.status, 200);
    assert.equal((await get(cookie)).status, 404);
    for (const name of [
      '../profile.sqlite',
      '..%2fprofile.sqlite',
      'github-credential.key',
      'a.pdf.html',
    ])
      assert.equal((await get('', '', name)).status, 404);
  } finally {
    await f.cleanup();
  }
});

test('Two administrators have independent sessions and session-bound CSRF; SQL-like usernames cannot authenticate', async () => {
  const f = await fixture();
  try {
    f.database.db
      .prepare('INSERT INTO admins VALUES(?,?)')
      .run('reviewer', await passwordHash('reviewer-password-for-testing'));
    const first = await f.login();
    const secondLogin = await f.call('/api/login', 'POST', {
      username: 'reviewer',
      password: 'reviewer-password-for-testing',
    });
    assert.equal(secondLogin.response.status, 200);
    const second = {
      cookie: secondLogin.response.headers.get('set-cookie')!.split(';')[0],
      'x-csrf-token': secondLogin.data.csrf,
    };
    const before = f.database.read();
    assert.equal(
      (await f.call('/api/admin/content', 'PUT', before, { ...second, 'x-csrf-token': first.csrf }))
        .response.status,
      403,
    );
    assert.equal((await f.call('/api/admin/content', 'PUT', before, second)).response.status, 200);
    assert.equal(
      (await f.call('/api/login', 'POST', { username: "admin' OR 1=1 --", password: 'incorrect' }))
        .response.status,
      401,
    );
    assert.equal((await f.call('/api/admin/logout', 'POST')).response.status, 200);
    assert.equal((await f.call('/api/admin/content')).response.status, 401);
    assert.equal(
      (await f.call('/api/admin/content', 'GET', undefined, second)).response.status,
      200,
    );
  } finally {
    await f.cleanup();
  }
});

test('Login limits survive API reload and database restart without locking other administrators; login bodies are bounded', async () => {
  const f = await fixture();
  try {
    const request = (username = 'blocked-user') =>
      new Request(f.origin + '/api/login', {
        method: 'POST',
        headers: { origin: f.origin, 'content-type': 'application/json' },
        body: JSON.stringify({ username, password: 'incorrect' }),
      });
    // Seed the exhausted bucket to avoid spending CPU on repeated password hashing.
    const { digest } = await import('../lib/auth.ts');
    f.database.db
      .prepare('INSERT INTO rate_limits VALUES(?,?,?)')
      .run('login-account:' + digest('blocked-user'), 30, Date.now() + 900000);
    assert.equal((await f.handle(request())).status, 429);
    assert.equal((await createApi(f.database)(request())).status, 429);
    const reopened = openDatabase(f.directory);
    try {
      assert.equal((await createApi(reopened)(request())).status, 429);
    } finally {
      reopened.db.close();
    }
    assert.equal((await f.login()).cookie.startsWith('profile_session='), true);
    const large = await f.handle(
      new Request(f.origin + '/api/login', {
        method: 'POST',
        headers: { origin: f.origin },
        body: 'x'.repeat(16385),
      }),
    );
    assert.equal(large.status, 413);
    f.database.db
      .prepare('UPDATE rate_limits SET until=0 WHERE key=?')
      .run('login-account:' + digest('blocked-user'));
    assert.equal((await f.handle(request())).status, 401);
  } finally {
    await f.cleanup();
  }
});

test('Public contact rate limits remain effective across API reloads and expire without deleting saved messages', async () => {
  const f = await fixture();
  try {
    const message = {
      name: 'QA visitor',
      email: 'qa@example.com',
      subject: 'QA contact',
      message: 'Synthetic message',
    };
    for (let i = 0; i < 30; i++)
      assert.equal((await f.call('/api/contact', 'POST', message)).response.status, 201);
    assert.equal((await f.call('/api/contact', 'POST', message)).response.status, 429);
    const request = () =>
      new Request(f.origin + '/api/contact', {
        method: 'POST',
        headers: { origin: f.origin, 'content-type': 'application/json' },
        body: JSON.stringify(message),
      });
    assert.equal((await createApi(f.database)(request())).status, 429);
    assert.equal(f.database.db.prepare('SELECT count(*) AS n FROM messages').get()!.n, 30);
    f.database.db.prepare("UPDATE rate_limits SET until=0 WHERE key LIKE 'contact%'").run();
    assert.equal((await createApi(f.database)(request())).status, 201);
    assert.equal(f.database.db.prepare('SELECT count(*) AS n FROM messages').get()!.n, 31);
  } finally {
    await f.cleanup();
  }
});

test('Rejected embedded-asset imports remove only their new files after schema, asset or version failure', async () => {
  const f = await fixture();
  try {
    await f.login();
    const original = await storeUpload(
      f.directory,
      Buffer.from('GIF89a preserved upload'),
      'image/gif',
    );
    const state = f.database.read();
    const image =
      'data:image/gif;base64,' + Buffer.from('GIF89a imported upload').toString('base64');
    const cases = [
      {
        ...structuredClone(state),
        data: {
          ...structuredClone(state.data),
          profile: { ...state.data.profile, avatar: image, name: '' },
        },
      },
      {
        ...structuredClone(state),
        data: {
          ...structuredClone(state.data),
          profile: { ...state.data.profile, avatar: image, cover: 'data:image/gif;base64,YmFk' },
        },
      },
      {
        ...structuredClone(state),
        version: state.version + 1,
        data: { ...structuredClone(state.data), profile: { ...state.data.profile, avatar: image } },
      },
    ];
    for (let i = 0; i < cases.length; i++) {
      assert.equal(
        (await f.call('/api/admin/import', 'POST', cases[i])).response.status,
        i === 2 ? 409 : 400,
      );
      assert.deepEqual(await readdir(path.join(f.directory, 'uploads')), [path.basename(original)]);
      assert.deepEqual(f.database.read(), state);
    }
  } finally {
    await f.cleanup();
  }
});
