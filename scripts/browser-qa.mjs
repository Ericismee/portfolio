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
async function chooseTestImage(selector, vertical = false) {
  await evaluate(
    `(async()=>{const c=document.createElement('canvas');c.width=1200;c.height=800;const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,1200,800);ctx.fillStyle='#0000ff';ctx.fillRect(${vertical ? '0,400,1200,400' : '600,0,600,800'});const blob=await new Promise(r=>c.toBlob(r,'image/png'));const transfer=new DataTransfer();transfer.items.add(new File([blob],'frame-test.png',{type:'image/png'}));const input=document.querySelector(${JSON.stringify(selector)});input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await waitFor(`!!document.querySelector('.crop-frame img')`);
  await pause(100);
}
try {
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
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
  await chooseTestImage('dialog [type=file]');
  await clickText('dialog button', 'Dùng khung ảnh này');
  await waitFor(`!!document.querySelector('dialog .frame-current')`, 'Image upload');
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
    'Profile no longer exposes legacy mock controls',
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
  // Inline editing uses the same authenticated API, from the actual profile.
  await go('/');
  await evaluate(`localStorage.setItem('profile-language','vi');location.reload()`);
  await waitFor(`!!document.querySelector('.inline-admin-menu')`);
  await clickText('.profile-body > .actions button', 'Chỉnh sửa hồ sơ');
  await fill('dialog [name=headline]', 'Inline QA engineer');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(
    `!document.querySelector('dialog')&&document.querySelector('.headline').textContent==='Inline QA engineer'`,
  );
  await go('/');
  await waitFor(`!!document.querySelector('.inline-admin-menu')`);
  await check(
    'Inline profile save survives reload',
    `document.querySelector('.headline').textContent==='Inline QA engineer'`,
  );
  await check(
    'Admin profile has no empty placeholder cards or large admin banner',
    `!document.querySelector('.inline-admin-bar')&&![...document.querySelectorAll('.section-heading h2')].some(e=>e.textContent==='Kinh nghiệm')`,
  );
  await evaluate(
    `(()=>{const section=[...document.querySelectorAll('section')].find(s=>s.querySelector('h2')?.textContent==='Kỹ năng');[...section.querySelectorAll('button')].find(b=>b.textContent==='Chỉnh sửa').click()})()`,
  );
  await waitFor(`!!document.querySelector('dialog [name=skills]')`);
  await fill('dialog [name=skills]', 'TypeScript\nNext.js\nAccessibility');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(`!document.querySelector('dialog')`);
  await check(
    'Skills saved through inline dialog',
    `fetch('/api/content').then(r=>r.json()).then(r=>r.data.skills.join(',')==='TypeScript,Next.js,Accessibility')`,
  );
  await evaluate(`document.querySelector('.inline-admin-menu summary').click()`);
  await clickText('.inline-admin-options button', 'Các mục hồ sơ');
  await check(
    'Empty sections remain editable in profile options',
    `!!document.querySelector('dialog [aria-label="Sửa Kinh nghiệm"]')`,
  );
  await fill('dialog [name=title]', 'Inline notes');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(`!document.querySelector('dialog')`);
  await evaluate(`document.querySelector('.inline-admin-menu summary').click()`);
  await clickText('.inline-admin-options button', 'Các mục hồ sơ');
  await evaluate(`document.querySelector('dialog [aria-label="Sửa Inline notes"]').click()`);
  await clickText('dialog button', 'Thêm nội dung');
  await fill('dialog [name=title]', 'Inline public entry');
  await fill('dialog [name=visibility]', 'public');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(
    `!document.querySelector('dialog')&&document.body.innerText.includes('Inline public entry')`,
  );
  await check(
    'Custom entry published from profile',
    `fetch('/api/content').then(r=>r.json()).then(r=>r.data.items['Inline notes'].some(i=>i.title==='Inline public entry'))`,
  );
  await clickText('.project-content button', 'Sửa dự án');
  await fill('dialog [name=description]', 'Project changed inline');
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(
    `!document.querySelector('dialog')&&document.body.innerText.includes('Project changed inline')`,
  );
  await clickText('.editable-avatar button', 'Sửa ảnh đại diện');
  await chooseTestImage('dialog [name=avatar-upload]');
  await check(
    'Pending framing blocks premature profile save',
    `document.querySelector('dialog button[type=submit]').disabled`,
  );
  await check(
    'Selected image is not public before save',
    `fetch('/api/content').then(r=>r.json()).then(r=>!r.data.profile.avatar)`,
  );
  await fill('dialog [name=avatar-zoom]', '2');
  await evaluate(`document.querySelector('.crop-frame').scrollIntoView({block:'center'})`);
  await pause(100);
  const frameBox = await evaluate(
    `(()=>{const r=document.querySelector('.crop-frame').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  const initialLeft = await evaluate(`document.querySelector('.crop-frame img').style.left`);
  await call('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: frameBox.x,
    y: frameBox.y,
    button: 'left',
    clickCount: 1,
  });
  await call('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: frameBox.x - 100,
    y: frameBox.y,
    button: 'left',
    buttons: 1,
  });
  await call('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: frameBox.x - 100,
    y: frameBox.y,
    button: 'left',
    clickCount: 1,
  });
  await pause(100);
  assert.notEqual(
    await evaluate(`document.querySelector('.crop-frame img').style.left`),
    initialLeft,
    'Pointer dragging changes image framing',
  );
  console.log('PASS Pointer dragging changes image framing');
  await evaluate(`document.querySelector('.crop-frame').focus()`);
  for (let i = 0; i < 3; i++) {
    await call('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'ArrowRight',
      code: 'ArrowRight',
      modifiers: 8,
    });
    await call('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'ArrowRight',
      code: 'ArrowRight',
      modifiers: 8,
    });
  }
  await pause(100);
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await pause(100);
  await snapshot('avatar-framing-mobile.png');
  await check(
    'Avatar framing fits mobile',
    `document.documentElement.scrollWidth<=innerWidth&&document.querySelector('dialog').getBoundingClientRect().bottom<=innerHeight`,
  );
  await clickText('dialog button', 'Dùng khung ảnh này');
  await waitFor(
    `!!document.querySelector('.frame-current')&&!document.querySelector('.crop-frame')`,
  );
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(
    `!document.querySelector('dialog')&&!!document.querySelector('.editable-avatar img')`,
  );
  await check(
    'Exported avatar preserves chosen pixels and square dimensions',
    `(async()=>{const d=await fetch('/api/content').then(r=>r.json());const img=new Image();img.src=d.data.profile.avatar;await img.decode();const c=document.createElement('canvas');c.width=800;c.height=800;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(50,400,1,1).data;return img.naturalWidth===800&&img.naturalHeight===800&&p[2]>240&&p[0]<15})()`,
  );
  await clickText('.inline-cover-action button', 'Sửa ảnh bìa');
  await chooseTestImage('dialog [name=cover-upload]', true);
  await clickText('dialog button', 'Hủy');
  await check(
    'Cancel framing leaves cover unchanged',
    `!document.querySelector('.crop-frame')&&!document.querySelector('dialog button[type=submit]').disabled`,
  );
  await chooseTestImage('dialog [name=cover-upload]', true);
  await evaluate(`document.querySelector('.crop-frame').focus()`);
  for (let i = 0; i < 7; i++) {
    await call('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'ArrowDown',
      code: 'ArrowDown',
      modifiers: 8,
    });
    await call('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'ArrowDown',
      code: 'ArrowDown',
      modifiers: 8,
    });
  }
  await pause(100);
  await snapshot('cover-framing-mobile.png');
  await clickText('dialog button', 'Dùng khung ảnh này');
  await waitFor(
    `!!document.querySelector('.frame-current')&&!document.querySelector('.crop-frame')`,
  );
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(`!document.querySelector('dialog')&&!!document.querySelector('.cover img')`);
  await check(
    'Exported cover preserves chosen pixels and wide dimensions',
    `(async()=>{const d=await fetch('/api/content').then(r=>r.json());const img=new Image();img.src=d.data.profile.cover;await img.decode();const c=document.createElement('canvas');c.width=1600;c.height=400;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(800,10,1,1).data;return img.naturalWidth===1600&&img.naturalHeight===400&&p[2]>240&&p[0]<15})()`,
  );
  for (const width of [360, 390, 768, 1024, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause(100);
    await check(
      'Inline admin profile no overflow at ' + width,
      `document.documentElement.scrollWidth<=innerWidth`,
    );
  }
  await evaluate(`scrollTo(0,0)`);
  await pause(100);
  await snapshot('inline-admin-profile.png');
  await clickText('.profile-body > .actions button', 'Chỉnh sửa hồ sơ');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await check(
    'Inline dialog fits mobile',
    `(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&r.width<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`,
  );
  await snapshot('inline-editor-mobile.png');
  await clickText('.editor-head button', '×');
  await evaluate(`document.querySelector('.inline-admin-menu summary').click()`);
  await clickText('.inline-admin-options button', 'Đăng xuất');
  await waitFor(`!document.querySelector('.inline-admin-menu')`);
  await check(
    'Guest cannot see editing controls or empty sections',
    `!document.querySelector('.inline-edit-button')&&![...document.querySelectorAll('.section-heading h2')].some(e=>e.textContent==='Kinh nghiệm')`,
  );
  await check(
    'Logged-out direct API write is rejected',
    `fetch('/api/admin/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status===403||r.status===401)`,
  );
  await go('/');
  await check(
    'Inline public changes remain after logout',
    `document.querySelector('.headline').textContent==='Inline QA engineer'&&!document.querySelector('.inline-admin-menu')`,
  );
  await check(
    'Guest can load published cropped images',
    `(async()=>{const images=[document.querySelector('.editable-avatar img'),document.querySelector('.cover img')];await Promise.all(images.map(img=>img.decode()));return images.every(img=>img.naturalWidth>0)&&!document.querySelector('a[href="/admin"]')})()`,
  );
  await snapshot('profile-mobile.png');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await snapshot('profile-desktop.png');
  assert.deepEqual(errors, [], 'No browser runtime exceptions');
  console.log('PASS Browser runtime has no uncaught exceptions');
} finally {
  ws.close();
}
