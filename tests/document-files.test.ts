import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { docxText, validateSvg } from '../lib/document-files.ts';
import { uploadExtension, storeUpload, readUpload, migrateAssets } from '../lib/uploads.ts';
import { openDatabase } from '../lib/database.ts';
import { uploadResponse } from '../lib/upload-response.ts';
import { documentTypes } from '../lib/file-types.ts';
import { uploadMime } from '../lib/upload-client.ts';
import { markdownUrl } from '../lib/markdown.ts';

function docx(extra: Record<string, Uint8Array> = {}) {
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    'word/document.xml': strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello &amp; welcome</w:t></w:r></w:p><w:p><w:r><w:t>&lt;script&gt; is text</w:t></w:r></w:p></w:body></w:document>',
    ),
    ...extra,
  });
}
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4263eb" d="M0 0h24v24H0z"/></svg>';
test('Documents validate their bytes and reject binary text, malformed DOCX, ZIP bombs and active SVG', async () => {
  assert.equal(docxText(docx()), 'Hello & welcome\n\n<script> is text');
  assert.equal(uploadExtension(Buffer.from(docx()), documentTypes.docx), 'docx');
  assert.equal(uploadExtension(Buffer.from('Tiếng Việt\nHello'), 'text/plain'), 'txt');
  assert.equal(uploadExtension(Buffer.from('# Hello'), 'text/markdown'), 'md');
  assert.doesNotThrow(() => validateSvg(strToU8(svg)));
  for (const payload of [
    svg.replace('<path', '<script>alert(1)</script><path'),
    svg.replace('<path', '<foreignObject/><path'),
    svg.replace('<path', '<path onload="alert(1)"'),
    svg.replace('<path', '<use href="https://example.test/a"/><path'),
    svg.replace('fill="#4263eb"', 'fill="url(https://example.test/a)"'),
    '<!DOCTYPE svg [<!ENTITY boom "test">]>' + svg,
    svg.replace('<path', '<style>@import "https://example.test";</style><path'),
    '<svg><unclosed>',
  ])
    assert.throws(() => uploadExtension(Buffer.from(payload), documentTypes.svg), { status: 400 });
  assert.throws(() => uploadExtension(Buffer.from([0, 255]), 'text/plain'), { status: 400 });
  assert.throws(() => uploadExtension(Buffer.from('not zip'), documentTypes.docx), { status: 400 });
  assert.throws(() => docxText(docx({ 'word/vbaProject.bin': strToU8('macro') })));
  assert.throws(() => docxText(docx({ large: new Uint8Array(40 * 1024 * 1024 + 1) })));
  assert.throws(() => uploadExtension(Buffer.alloc(20 * 1024 * 1024 + 1), 'text/plain'), {
    status: 413,
  });
  for (const [ext, mime] of Object.entries(documentTypes)) {
    const body = ext === 'pdf' ? '%PDF-' : 'sample';
    assert.equal(await uploadMime(new File([body], 'file.' + ext)), mime);
  }
  await assert.rejects(uploadMime(new File(['binary'], 'file.exe')), /Unsupported/);
});

test('New document formats remain private until published, revoke immediately and survive import byte-for-byte', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'eric-documents-'));
  const database = openDatabase(directory);
  try {
    for (const [ext, mime, bytes] of [
      ['txt', 'text/plain', Buffer.from('<script>alert(1)</script>')],
      ['md', 'text/markdown', Buffer.from('# Markdown')],
      ['svg', documentTypes.svg, Buffer.from(svg)],
      ['docx', documentTypes.docx, Buffer.from(docx())],
    ] as const) {
      const url = await storeUpload(directory, bytes, mime);
      const name = path.basename(url);
      const request = new Request('http://localhost:3001' + url);
      assert.equal((await uploadResponse(database, request, name)).status, 404);
      const state = await database.read();
      state.data.cv = { name: 'Resume.' + ext, url };
      await database.write(state.data, state.version);
      const response = await uploadResponse(database, request, name);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), mime);
      assert.match(response.headers.get('Content-Security-Policy')!, /sandbox/);
      assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
      assert.match(response.headers.get('Cache-Control')!, /no-store/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
      assert.match(
        (
          await uploadResponse(database, new Request(request.url + '?download=1'), name)
        ).headers.get('Content-Disposition')!,
        /^attachment/,
      );
      assert.equal(markdownUrl(url, 'https://github.com/user/repo/'), url);
      const current = await database.read();
      delete current.data.cv;
      await database.write(current.data, current.version);
      assert.equal((await uploadResponse(database, request, name)).status, 404);
      const migrated = (await migrateAssets(
        'data:' + mime + ';base64,' + bytes.toString('base64'),
        directory,
      )) as string;
      assert.deepEqual(await readUpload(directory, path.basename(migrated)), bytes);
    }
  } finally {
    database.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
