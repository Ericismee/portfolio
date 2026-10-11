import { MAX_UPLOAD_BYTES } from './upload-limits.ts';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './database.ts';
export const mimeTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};
const signatures: Record<string, (b: Buffer) => boolean> = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  jpg: (b) => b[0] === 255 && b[1] === 216 && b[2] === 255,
  gif: (b) => /^GIF8[79]a/.test(b.subarray(0, 6).toString()),
  webp: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  pdf: (b) => b.subarray(0, 5).toString() === '%PDF-',
};
export async function storeUpload(directory: string, bytes: Buffer, mime: string) {
  const ext = Object.keys(signatures).find((k) => signatures[k](bytes));
  if (!ext || mimeTypes[ext] !== mime)
    throw new HttpError(400, 'Unsupported or invalid file / File không hợp lệ');
  if (bytes.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'File too large / File quá lớn');
  const folder = path.join(directory, 'uploads');
  await mkdir(folder, { recursive: true });
  const name = randomUUID() + '.' + ext;
  await writeFile(path.join(folder, name), bytes, { flag: 'wx', mode: 0o600 });
  return '/uploads/' + name;
}
export const readUpload = (directory: string, name: string) =>
  readFile(path.join(directory, 'uploads', name));
export async function migrateAssets(
  input: unknown,
  directory: string,
  created: string[] = [],
): Promise<unknown> {
  if (typeof input === 'string' && input.startsWith('data:')) {
    const m =
      /^data:(image\/(?:png|jpeg|gif|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(input);
    if (!m) throw new HttpError(400, 'Unsupported imported file');
    const url = await storeUpload(directory, Buffer.from(m[2], 'base64'), m[1]);
    created.push(url);
    return url;
  }
  if (Array.isArray(input)) {
    // Await every write before propagating failure so rollback cannot race pending writes.
    const result: unknown[] = [];
    for (const value of input) result.push(await migrateAssets(value, directory, created));
    return result;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k))
        throw new HttpError(400, 'Invalid key');
      out[k] = await migrateAssets(v, directory, created);
    }
    return out;
  }
  return input;
}
