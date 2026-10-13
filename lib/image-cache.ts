import sharp from 'sharp';
import { createHash } from 'node:crypto';
const cache = new Map<string, { bytes: Buffer; etag: string }>();
const pending = new Map<string, Promise<{ bytes: Buffer; etag: string }>>();
let size = 0;
let active = 0;
const waiting: (() => void)[] = [];
export class ImageBusyError extends Error {}
async function acquire() {
  if (active < 2) {
    active++;
    return;
  }
  if (waiting.length >= 8) throw new ImageBusyError('Image processing busy');
  await new Promise<void>((resolve) => waiting.push(resolve));
}
function release() {
  const next = waiting.shift();
  if (next) next();
  else active--;
}
export async function imageVariant(key: string, width: number, read: () => Promise<Buffer>) {
  const id = `${key}:${width}`;
  const found = cache.get(id);
  if (found) {
    cache.delete(id);
    cache.set(id, found);
    return found;
  }
  let task = pending.get(id);
  if (!task) {
    task = (async () => {
      await acquire();
      try {
        const source = await read();
        const bytes = await sharp(source, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 90, effort: 4, smartSubsample: true })
          .toBuffer();
        const result = {
          bytes,
          etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"',
        };
        while (size + bytes.length > 32 * 1024 * 1024 && cache.size) {
          const oldest = cache.keys().next().value!;
          size -= cache.get(oldest)!.bytes.length;
          cache.delete(oldest);
        }
        if (bytes.length <= 32 * 1024 * 1024) {
          cache.set(id, result);
          size += bytes.length;
        }
        return result;
      } finally {
        release();
      }
    })().finally(() => pending.delete(id));
    pending.set(id, task);
  }
  return task;
}
