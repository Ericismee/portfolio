import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropRectangle } from '../lib/image-crop.ts';

test('Image framing stays within the source for square, cover and landscape crops', () => {
  assert.deepEqual(cropRectangle(1200, 800, 1, { x: 0.5, y: 0.5, zoom: 1 }), {
    x: 200,
    y: 0,
    width: 800,
    height: 800,
  });
  assert.deepEqual(cropRectangle(1200, 800, 4, { x: 0.5, y: 1, zoom: 2 }), {
    x: 300,
    y: 650,
    width: 600,
    height: 150,
  });
  for (const [width, height] of [
    [1200, 800],
    [600, 1800],
    [50, 50],
  ])
    for (const aspect of [1, 4, 16 / 9])
      for (const zoom of [0, 1, 1.7, 4, 9])
        for (const x of [-1, 0, 0.5, 1, 2]) {
          const crop = cropRectangle(width, height, aspect, { x, y: 1 - x, zoom });
          assert(crop.x >= 0 && crop.y >= 0);
          assert(crop.x + crop.width <= width + 1e-8 && crop.y + crop.height <= height + 1e-8);
          assert(Math.abs(crop.width / crop.height - aspect) < 1e-8);
        }
});
