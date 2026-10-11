export type TrafficDay = { date: string; views: number; visits: number };

// Bound the number of SVG points while preserving every view and session.
// Long histories use calendar months/years instead of discarding older days.
export function trafficSeries(days: TrafficDay[], from = '', to = '') {
  if (!days.length) return { grain: 'day' as const, points: [] as TrafficDay[] };
  const start = from || days[0].date;
  const end = to || days[days.length - 1].date;
  const span = (Date.parse(end) - Date.parse(start)) / 86400_000;
  const grain = span <= 92 ? 'day' : span <= 3652 ? 'month' : 'year';
  const length = grain === 'day' ? 10 : grain === 'month' ? 7 : 4;
  const totals = new Map<string, TrafficDay>();
  for (const day of days) {
    const key = day.date.slice(0, length);
    const previous = totals.get(key) || { date: key, views: 0, visits: 0 };
    previous.views += day.views;
    previous.visits += day.visits;
    totals.set(key, previous);
  }
  const cursor = new Date(start + 'T00:00:00Z');
  if (grain !== 'day') cursor.setUTCDate(1);
  if (grain === 'year') cursor.setUTCMonth(0);
  const points: TrafficDay[] = [];
  while (cursor.toISOString().slice(0, length) <= end.slice(0, length)) {
    const key = cursor.toISOString().slice(0, length);
    points.push(totals.get(key) || { date: key, views: 0, visits: 0 });
    if (grain === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (grain === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
  }
  return { grain, points };
}
