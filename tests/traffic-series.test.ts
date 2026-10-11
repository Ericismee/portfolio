import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trafficSeries } from '../lib/traffic-series.ts';

test('Traffic charts include zero days and preserve views and sessions across calendar months', () => {
  const short = trafficSeries([
    { date: '2026-10-01', views: 3, visits: 2 },
    { date: '2026-10-03', views: 1, visits: 1 },
  ]);
  assert.equal(short.grain, 'day');
  assert.deepEqual(short.points[1], { date: '2026-10-02', views: 0, visits: 0 });
  const long = trafficSeries([
    { date: '2024-02-29', views: 5, visits: 4 },
    { date: '2024-03-01', views: 2, visits: 1 },
    { date: '2025-03-01', views: 3, visits: 2 },
  ]);
  assert.equal(long.grain, 'month');
  assert.equal(long.points.length, 14);
  assert.equal(
    long.points.reduce((sum, row) => sum + row.views, 0),
    10,
  );
  assert.equal(
    long.points.reduce((sum, row) => sum + row.visits, 0),
    7,
  );
  assert.deepEqual(long.points[2], { date: '2024-04', views: 0, visits: 0 });
});

test('Long histories use bounded yearly charts without discarding old data', () => {
  const result = trafficSeries([
    { date: '2000-01-01', views: 7, visits: 3 },
    { date: '2026-10-12', views: 2, visits: 1 },
  ]);
  assert.equal(result.grain, 'year');
  assert.equal(result.points.length, 27);
  assert.equal(result.points[0].views, 7);
  assert.equal(result.points[26].views, 2);
  assert.deepEqual(trafficSeries([]).points, []);
});
