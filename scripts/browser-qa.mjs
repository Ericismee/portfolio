import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../lib/database.ts';
import { passwordHash } from '../lib/auth.ts';
import { contentSchema } from '../lib/schema.ts';
import { initial, skills } from '../lib/seed.ts';

// Run against an isolated preview database on port 3002. Never reset the owner's
// browser storage or run destructive QA against a public production deployment.
const base = 'http://localhost:3002';
const directory = path.resolve('.qa-next-data');
const password = randomBytes(24).toString('base64url');
const database = openDatabase(directory);
const baseline = contentSchema.parse({
  ...initial,
  skills,
  posts: [],
  projects: initial.projects.map((p) => ({ ...p, visibility: 'public' })),
});
database.db.prepare('UPDATE content SET version=1,body=? WHERE id=1').run(JSON.stringify(baseline));
database.db.exec(
  'DELETE FROM sessions; DELETE FROM admins; DELETE FROM messages; DELETE FROM revisions;',
);
database.db
  .prepare(
    'INSERT INTO admins VALUES(?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash',
  )
  .run('qa-admin', await passwordHash(password));
database.db.close();
const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = pages.find((p) => p.type === 'page');
assert(page, 'Open an isolated Chrome preview with remote debugging on port 9222.');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => (ws.onopen = resolve));
let sequence = 0;
const pending = new Map(),
  errors = [];
ws.onmessage = (e) => {
  const message = JSON.parse(e.data);
  if (message.method === 'Page.javascriptDialogOpening') {
    errors.push('Unexpected browser dialog: ' + message.params.message);
    ws.send(
      JSON.stringify({
        id: ++sequence,
        method: 'Page.handleJavaScriptDialog',
        params: { accept: false },
      }),
    );
  }
  if (message.method === 'Runtime.exceptionThrown')
    errors.push(message.params.exceptionDetails.text);
  if (pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
const call = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++sequence;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const message = await call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert(!message.result.exceptionDetails, JSON.stringify(message.result.exceptionDetails));
  return message.result.result.value;
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, label = expression) {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw Error('Timed out: ' + label);
}
async function go(route) {
  await call('Page.navigate', { url: base + route });
  await waitFor(`document.readyState==='complete'&&document.body.innerText.length>20`);
  await pause(250);
}
async function fill(selector, value) {
  await evaluate(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
}
async function clickText(selector, text) {
  assert(
    await evaluate(
      `(()=>{const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!el)return false;el.focus();el.click();return true})()`,
    ),
    'Missing button: ' + text,
  );
  await pause(100);
}
async function check(label, expression) {
  assert.equal(await evaluate(expression), true, label);
  console.log('PASS', label);
}
async function snapshot(name) {
  await mkdir('docs/screenshots', { recursive: true });
  const result = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile('docs/screenshots/' + name, Buffer.from(result.result.data, 'base64'));
}
try {
  await call('Runtime.enable');
  await call('Page.enable');
  await go('/admin');
  await evaluate(`localStorage.setItem('profile-language','vi');location.reload()`);
  await waitFor(`!!document.querySelector('[name=username]')`);
  await fill('[name=username]', 'qa-admin');
  await fill('[name=password]', password);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await waitFor(`!!document.querySelector('.admin-nav')`, 'Admin login');
  console.log('PASS Admin login through the real form');
  await clickText('.admin-nav button', 'Bài viết');
  await clickText('.admin-title button', '＋ Thêm mới');
  await waitFor(`!!document.querySelector('dialog[open] [name=title]')`);
  await fill('dialog [name=title]', 'QA draft');
  await fill('dialog [name=text]', 'A genuine browser test of draft and published content.');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(`!document.querySelector('dialog')`, 'Create draft');
  await check(
    'Draft absent from public API',
    `fetch('/api/content').then(r=>r.json()).then(r=>!r.data.posts.some(p=>p.title==='QA draft'))`,
  );
  await clickText('.admin-row button', 'Sửa');
  await waitFor(`!!document.querySelector('dialog [name=visibility]')`);
  await fill('dialog [name=title]', 'QA published');
  await fill('dialog [name=visibility]', 'public');
  await fill('dialog [name=displayAt]', '2026-01-01T12:00');
  await evaluate(
    `(()=>{const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0)),transfer=new DataTransfer();transfer.items.add(new File([bytes],'pixel.png',{type:'image/png'}));const input=document.querySelector('dialog [type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`,
  );
  await waitFor(`!!document.querySelector('dialog .admin-asset')`, 'Image upload');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(`!document.querySelector('dialog')`);
  await check(
    'Published post and uploaded image in public API',
    `fetch('/api/content').then(r=>r.json()).then(r=>r.data.posts.some(p=>p.title==='QA published'&&p.image.startsWith('/uploads/')))`,
  );
  const postId = await evaluate(
    `fetch('/api/content').then(r=>r.json()).then(r=>r.data.posts.find(p=>p.title==='QA published').id)`,
  );
  await clickText('.admin-row button', 'Ẩn');
  await waitFor(`document.querySelector('.admin-row').innerText.includes('Đã ẩn')`);
  await check(
    'Hide removes post from public API',
    `fetch('/api/content').then(r=>r.json()).then(r=>!r.data.posts.some(p=>p.id===${JSON.stringify(postId)}))`,
  );
  await clickText('.admin-row button', 'Hiện');
  await waitFor(`document.querySelector('.admin-row').innerText.includes('Công khai')`);
  await clickText('.admin-row button', 'Xóa');
  await waitFor(`!!document.querySelector('dialog')`);
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(`!document.querySelector('dialog')`);
  await clickText('.admin-nav button', 'Thùng rác');
  await waitFor(`document.querySelector('.admin-row')?.innerText.includes('QA published')`);
  await clickText('.admin-row button', 'Khôi phục');
  await waitFor(`!document.querySelector('.admin-row')`);
  await clickText('.admin-nav button', 'Bài viết');
  await check(
    'Trash restore returns post as draft',
    `document.querySelector('.admin-row').innerText.includes('Bản nháp')`,
  );
  await clickText('.admin-nav button', 'Dự án');
  const first = await evaluate(
    `fetch('/api/admin/content').then(r=>r.json()).then(r=>r.data.projects[0].id)`,
  );
  await evaluate(
    `document.querySelector('.admin-row button[aria-label="Di chuyển xuống"]').click()`,
  );
  await waitFor(`!document.querySelector('main').innerText.includes('Đang lưu…')`);
  await check(
    'Project reordering persists',
    `fetch('/api/content').then(r=>r.json()).then(r=>r.data.projects[1].id===${JSON.stringify(first)})`,
  );
  await clickText('.admin-nav button', 'Các mục hồ sơ');
  await clickText('.admin-content button', '＋ Tạo mục');
  await waitFor(`!!document.querySelector('dialog [name=title]')`);
  await fill('dialog [name=title]', 'Talks');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(`!document.querySelector('dialog')`);
  await evaluate(
    `(()=>{const row=[...document.querySelectorAll('.admin-row')].find(r=>r.querySelector('h3')?.textContent==='Talks');[...row.querySelectorAll('button')].find(b=>b.textContent==='Nội dung').click()})()`,
  );
  await clickText('.admin-content button', '＋ Thêm nội dung');
  await waitFor(`!!document.querySelector('dialog [name=title]')`);
  await fill('dialog [name=title]', 'TypeScript in practice');
  await fill('dialog [name=visibility]', 'public');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(`!document.querySelector('dialog')`);
  await check(
    'Custom section content persists',
    `fetch('/api/content').then(r=>r.json()).then(r=>r.data.items.Talks[0].title==='TypeScript in practice')`,
  );
  await clickText('.admin-nav button', 'Giao diện & dữ liệu');
  await fill('[name=accent]', '#315fd2');
  await fill('[name=layout]', 'wide');
  await evaluate(`document.querySelector('.admin-content form').requestSubmit()`);
  await pause(250);
  await check(
    'Appearance persists to server',
    `fetch('/api/content').then(r=>r.json()).then(r=>r.data.accent==='#315fd2'&&r.data.layout==='wide')`,
  );
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await snapshot('admin-desktop.png');
  for (const width of [360, 390, 768, 1024, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const label of [
      'Hồ sơ & liên hệ',
      'Dự án',
      'Bài viết',
      'Các mục hồ sơ',
      'Giao diện & dữ liệu',
    ]) {
      await clickText('.admin-nav button', label);
      await check(
        'Admin ' + label + ' no overflow at ' + width,
        `document.documentElement.scrollWidth<=innerWidth+1`,
      );
    }
    if (width === 390) await snapshot('admin-mobile.png');
  }
  await go('/');
  await check(
    'Public has no owner editing controls',
    `!document.querySelector('[data-action=edit-profile]')&&!document.body.innerText.includes('Bản demo')`,
  );
  for (const width of [360, 390, 768, 1024, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const route of [
      '/',
      '/projects',
      '/projects/notebooke',
      '/activity',
      '/contact',
      '/search?q=AI',
    ]) {
      await go(route);
      await check(
        'Public ' + route + ' no overflow at ' + width,
        `document.documentElement.scrollWidth<=innerWidth+1`,
      );
    }
    if (width === 390) {
      await go('/');
      await snapshot('profile-mobile.png');
    }
  }
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await go('/');
  await snapshot('profile-desktop.png');
  await clickText('.sidebar button', 'English');
  await check(
    'English profile navigation',
    `document.documentElement.lang==='en'&&document.querySelector('header nav').innerText.includes('Projects')`,
  );
  await go('/contact');
  await fill('[name=name]', 'Browser visitor');
  await fill('[name=email]', 'visitor@example.com');
  await fill('[name=subject]', 'Browser contact test');
  await fill('[name=message]', 'This message was sent through the actual contact form.');
  await evaluate(`document.querySelector('.contact-form').requestSubmit()`);
  await waitFor(
    `document.querySelector('.contact-form [role=status]').textContent.includes('Message sent')`,
  );
  console.log('PASS Real contact form persists message');
  await go('/admin');
  await waitFor(`!!document.querySelector('.admin-nav')`);
  await clickText('.admin-nav button', 'Inbox');
  await waitFor(`document.querySelector('main').innerText.includes('Browser contact test')`);
  console.log('PASS Inbox displays contact message');
  await clickText('.admin-nav button', 'Posts');
  await clickText('.admin-title button', '＋ Add new');
  await waitFor(`!!document.querySelector('dialog [name=title]')`);
  await check('Dialog focuses first field', `document.activeElement.name==='title'`);
  for (let i = 0; i < 20; i++) {
    await call('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    await call('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    await check(
      'Dialog keyboard focus stays contained ' + i,
      `document.querySelector('dialog').contains(document.activeElement)`,
    );
  }
  await fill('dialog [name=title]', 'Unsaved QA change');
  // Synthetic input dispatch does not have the browser's native typing cadence.
  // Wait for React's dirty indicator before exercising the next keyboard event.
  await waitFor(`document.querySelector('dialog form').innerText.includes('Unsaved changes')`);
  await pause(50);
  const pressEscape = async () => {
    await call('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    await call('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
  };
  await pressEscape();
  await waitFor(`!!document.querySelector('dialog[open] .admin-intro[role=alert]')`);
  await check(
    'Escape retains unsaved content',
    `document.querySelector('dialog [name=title]').value==='Unsaved QA change'`,
  );
  await evaluate(`document.querySelector('dialog .admin-intro button').click()`);
  await waitFor(`!document.querySelector('dialog .admin-intro')`);
  await check(
    'Continue editing restores field focus',
    `document.querySelector('dialog').open&&document.activeElement.name==='title'`,
  );
  await pressEscape();
  await waitFor(`!!document.querySelector('dialog .admin-intro')`);
  await evaluate(`document.querySelectorAll('dialog .admin-intro button')[1].click()`);
  await waitFor(`!document.querySelector('dialog')`);
  await check(
    'Explicit discard restores opener focus',
    `document.activeElement===document.querySelector('.admin-title button')`,
  );
  assert.deepEqual(errors, [], 'No browser runtime exceptions');
  console.log('PASS Browser runtime has no uncaught exceptions');
} finally {
  ws.close();
}
