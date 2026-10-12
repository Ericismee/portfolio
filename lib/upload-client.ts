import { MAX_UPLOAD_BYTES } from './upload-limits.ts';
import { put } from '@vercel/blob/client';
import { RequestError } from './client.ts';
import { documentKind, documentTypes } from './file-types.ts';
type UploadOptions = { onProgress?: (percentage: number) => void; signal?: AbortSignal };
async function jsonPost(url: string, body: unknown, csrf: string, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const result = await response.json();
  if (!response.ok) throw new RequestError(result.error || 'Upload failed', response.status);
  return result;
}
async function directUpload(
  file: Blob,
  mime: string,
  csrf: string,
  options: UploadOptions = {},
): Promise<string | null> {
  if (file.size > MAX_UPLOAD_BYTES) throw Error('File up to 20 MB / File tối đa 20 MB');
  const intent = await jsonPost('/api/admin/upload-init', { mime, size: file.size }, csrf);
  if (intent.mode === 'local') return null;
  await put(intent.pathname, file, {
    access: 'private',
    token: intent.token,
    contentType: mime,
    multipart: file.size > 4 * 1024 * 1024,
    abortSignal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(120000)])
      : AbortSignal.timeout(120000),
    onUploadProgress: ({ percentage }) =>
      options.onProgress?.(Math.min(95, Math.round(percentage * 0.95))),
  });
  return intent.id;
}
export async function uploadFile(
  file: File,
  mime: string,
  csrf: string,
  options: UploadOptions = {},
): Promise<string> {
  options.onProgress?.(0);
  const id = await directUpload(file, mime, csrf, options);
  if (id) {
    options.signal?.throwIfAborted();
    options.onProgress?.(95);
    const result = await jsonPost('/api/admin/upload-finish', { id }, csrf);
    options.onProgress?.(100);
    return result.url;
  }
  if (typeof XMLHttpRequest !== 'undefined' && options.onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const cleanup = () => options.signal?.removeEventListener('abort', abort);
      xhr.open('POST', '/api/admin/upload');
      xhr.setRequestHeader('Content-Type', mime);
      xhr.setRequestHeader('x-csrf-token', csrf);
      xhr.timeout = 120000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          options.onProgress?.(Math.min(95, Math.round((e.loaded / e.total) * 95)));
      };
      xhr.onerror = xhr.ontimeout = () => {
        cleanup();
        reject(new Error('Upload interrupted / Tải file bị gián đoạn'));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new DOMException('Upload cancelled', 'AbortError'));
      };
      xhr.onload = () => {
        cleanup();
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300)
            throw new RequestError(result.error || 'Upload failed', xhr.status);
          options.onProgress?.(100);
          resolve(result.url);
        } catch (error) {
          reject(error);
        }
      };
      if (options.signal?.aborted) {
        reject(options.signal.reason);
        return;
      }
      options.signal?.addEventListener('abort', abort, { once: true });
      xhr.send(file);
    });
  }
  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { 'Content-Type': mime, 'x-csrf-token': csrf },
    body: file,
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  options.onProgress?.(100);
  return result.url;
}
export async function importContent(data: unknown, version: number, csrf: string) {
  const id = await directUpload(
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
    'application/json',
    csrf,
  );
  return id
    ? jsonPost('/api/admin/import-blob', { id, version }, csrf)
    : jsonPost('/api/admin/import', { data, version }, csrf);
}
export async function saveLargeContent(data: unknown, version: number, csrf: string) {
  const id = await directUpload(
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
    'application/json',
    csrf,
  );
  return id
    ? jsonPost('/api/admin/content-blob', { id, version }, csrf)
    : jsonPost('/api/admin/content', { data, version }, csrf, 'PUT');
}
export async function uploadMime(file: File): Promise<string> {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (file.size > MAX_UPLOAD_BYTES) throw Error('File tối đa 20 MB / File up to 20 MB');
  if (pdf) {
    const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (signature !== '%PDF-') throw Error('File PDF không hợp lệ / Invalid PDF file');
    return 'application/pdf';
  }
  const kind = documentKind(file.name);
  if (kind === 'svg' && file.size > 1024 * 1024) throw Error('SVG tối đa 1 MB / SVG up to 1 MB');
  if (!file.size) throw Error('File trống / Empty file');
  if (kind) return documentTypes[kind];
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type))
    throw Error('Unsupported file type / Định dạng file chưa hỗ trợ');
  return file.type;
}
