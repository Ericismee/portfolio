import sharp from 'sharp';
import { createHash } from 'node:crypto';
const cache = new Map<string, { bytes: Buffer; etag: string }>();
const pending = new Map<string, Promise<{ bytes: Buffer; etag: string }>>();
let size = 0;
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
      const source = await read();
      const bytes = await sharp(source, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80, effort: 3 })
        .toBuffer();
      const result = { bytes, etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"' };
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
    })().finally(() => pending.delete(id));
    pending.set(id, task);
  }
  return task;
}
