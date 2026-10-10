import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, HttpError } from '../lib/database.ts';
import { createApi } from '../lib/api.ts';
import { passwordHash } from '../lib/auth.ts';
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
        visible: true,
        visibility: 'public',
      },
    ];
    state = (await f.call('/api/admin/content', 'PUT', state)).data;
    assert.equal((await f.call('/api/content')).data.data.items.Talks.length, 1);
    state.data.hidden.push('Talks');
    state = (await f.call('/api/admin/content', 'PUT', state)).data;
    assert.equal((await f.call('/api/content')).data.data.items.Talks.length, 0);
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
    state.data.profile.logo = '/uploads/1234-abcd.png';
    state.data.theme = 'dark';
    state.data.density = 'compact';
    state.data.layout = 'wide';
    const saved = await f.call('/api/admin/content', 'PUT', state);
    assert.equal(saved.response.status, 200);
    assert.equal(saved.data.data.profile.logo, state.data.profile.logo);
    assert.equal(publicContent(f.database.read().data).profile.logo, state.data.profile.logo);
    assert.equal(f.database.read().data.theme, 'dark');
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
    const large = Buffer.alloc(3 * 1024 * 1024 + 1);
    large.write('GIF89a');
    assert.equal((await upload(large, 'image/gif')).status, 413);
    const pdf = Buffer.alloc(2 * 1024 * 1024 + 1);
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
    await f.login();
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
