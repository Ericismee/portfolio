import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleTime } from '../lib/visible-time.ts';

test('Viewing clock counts visible time, pauses hidden tabs and bounds suspended timers', () => {
  const tick = visibleTime(0, true);
  assert.equal(tick(1000), 1000);
  assert.equal(tick(2500, false), 2500);
  assert.equal(tick(100000, false), 2500);
  assert.equal(tick(110000, true), 2500);
  assert.equal(tick(112000), 4500);
  assert.equal(tick(500000), 64500);
  assert.equal(tick(500000), 64500);
});
