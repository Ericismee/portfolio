import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { imageVariant, ImageBusyError } from '../lib/image-cache.ts';
import { responsiveImage } from '../lib/image-variants.ts';

test('Retina image variants retain source dimensions and alpha without enlarging originals', async () => {
  const bytes = await sharp({
    create: { width: 2400, height: 1200, channels: 4, background: '#4264da80' },
  })
    .png()
    .toBuffer();
  const result = await imageVariant('retina-test', 2560, async () => bytes);
  const meta = await sharp(result.bytes).metadata();
  assert.equal(meta.width, 2400);
  assert.equal(meta.height, 1200);
  assert.equal(meta.hasAlpha, true);
  const props = responsiveImage('/uploads/abcdef.png');
  assert.match(props.srcSet!, /w=1920 1920w/);
  assert.match(props.srcSet!, /w=2560 2560w/);
});

test('Public image processing bounds active decoders and rejects an excessive queue', async () => {
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } })
    .png()
    .toBuffer();
  let reads = 0;
  let unblock!: () => void;
  const gate = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const jobs = Array.from({ length: 11 }, (_, index) =>
    imageVariant('bounded-image-' + index, 96, async () => {
      reads++;
      await gate;
      return bytes;
    }).then(
      () => 'ok',
      (error) => error,
    ),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(reads, 2);
  unblock();
  const results = await Promise.all(jobs);
  assert.equal(results.filter((result) => result === 'ok').length, 10);
  assert.equal(results.filter((result) => result instanceof ImageBusyError).length, 1);
});
