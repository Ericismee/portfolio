import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { GithubSkills } from './github-skills';

const daySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().nonnegative(),
  level: z.number().int().min(0).max(4),
});
const calendarSchema = z.object({
  days: z.array(daySchema),
  year: z.number().int(),
  total: z.number().int().nonnegative(),
});
const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  repo: z.string(),
  date: z.string(),
  action: z.string(),
});
const commitSchema = z.object({
  sha: z.string(),
  repo: z.string(),
  message: z.string(),
  date: z.string(),
});
const eventsSchema = z.object({
  items: z.array(eventSchema),
  etag: z.string().nullable(),
  pollSeconds: z.number().min(60),
  notBefore: z.number().default(0),
});
export type ContributionDay = z.infer<typeof daySchema>;
export type GithubActivity = {
  calendar: z.infer<typeof calendarSchema> | null;
  events: z.infer<typeof eventSchema>[];
  commits: z.infer<typeof commitSchema>[];
  calendarStatus: 'ready' | 'stale' | 'unavailable';
  eventsStatus: 'ready' | 'stale' | 'unavailable';
  commitsStatus: 'ready' | 'stale' | 'unavailable';
  checkedAt: string;
  calendarUpdatedAt: string | null;
  eventsUpdatedAt: string | null;
  commitsUpdatedAt: string | null;
  pollSeconds: number;
  commitRepositories: number;
};

// Parse GitHub's public calendar, never manufacture counts from event frequency.
// An upstream markup change fails closed rather than showing an empty fake year.
export function parseContributions(html: string, year: number): z.infer<typeof calendarSchema> {
  const tips = new Map<string, number>();
  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const id = /\bfor="([^"]+)"/.exec(match[1])?.[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    const count = /^No contributions?\b/i.test(text)
      ? 0
      : Number(/^([\d,]+) contributions?\b/i.exec(text)?.[1]?.replaceAll(',', ''));
    if (id && Number.isFinite(count)) tips.set(id, count);
  }
  const days: ContributionDay[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const match of html.matchAll(/<td\b([^>]*)>/g)) {
    const attrs = match[1];
    const date = /\bdata-date="([^"]+)"/.exec(attrs)?.[1];
    const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
    const level = Number(/\bdata-level="([0-4])"/.exec(attrs)?.[1]);
    if (!date || !date.startsWith(year + '-') || date > today) continue;
    if (!id || !tips.has(id) || !Number.isInteger(level))
      throw Error('Incomplete contribution calendar');
    days.push(daySchema.parse({ date, count: tips.get(id), level }));
  }
  if (!days.length || new Set(days.map((day) => day.date)).size !== days.length)
    throw Error('Invalid contribution calendar');
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { year, days, total: days.reduce((sum, day) => sum + day.count, 0) };
}

type Snapshot<T> = {
  value: T | null;
  status: 'ready' | 'stale' | 'unavailable';
  at: string | null;
};
const memory = new Map<string, { expires: number; promise: Promise<Snapshot<unknown>> }>();
async function cached<T>(
  key: string,
  schema: z.ZodType<T>,
  ttl: number,
  load: (previous: T | null) => Promise<T>,
): Promise<Snapshot<T>> {
  const old = memory.get(key);
  if (old && old.expires > Date.now()) return old.promise as Promise<Snapshot<T>>;
  const promise = (async () => {
    const filename = path.resolve(process.env.DATA_DIR || '.data', 'github-cache', key + '.json');
    let saved: { value: T; at: string } | null = null;
    try {
      const raw = JSON.parse(await readFile(filename, 'utf8'));
      saved = { value: schema.parse(raw.value), at: z.iso.datetime().parse(raw.at) };
    } catch {
      /* First load or invalid cache. */
    }
    if (saved && Date.now() - Date.parse(saved.at) < ttl)
      return { value: saved.value, status: 'ready' as const, at: saved.at };
    try {
      const value = schema.parse(await load(saved?.value || null));
      const at = new Date().toISOString();
      try {
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, JSON.stringify({ value, at }));
      } catch {
        /* Memory caching still works on read-only disks. */
      }
      return { value, status: 'ready' as const, at };
    } catch {
      return {
        value: saved?.value || null,
        status: saved ? ('stale' as const) : ('unavailable' as const),
        at: saved?.at || null,
      };
    }
  })();
  memory.set(key, { expires: Date.now() + ttl, promise });
  return promise;
}
const validRepo = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
async function api(route: string, etag?: string | null) {
  return fetch('https://api.github.com' + route, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Eric-Profile',
      ...(etag ? { 'If-None-Match': etag } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
}
export async function getGithubActivity(
  username: string,
  year: number,
  repos: GithubSkills['repos'],
): Promise<GithubActivity> {
  if (
    !/^[a-zA-Z0-9-]{1,39}$/.test(username) ||
    !Number.isInteger(year) ||
    year < 2008 ||
    year > new Date().getUTCFullYear()
  )
    throw Error('Invalid GitHub request');
  const user = encodeURIComponent(username);
  const key = username.toLowerCase();
  const recent = repos.filter((repo) => !repo.fork && !repo.archived).slice(0, 6);
  const [calendar, events, commits] = await Promise.all([
    cached('calendar-' + key + '-' + year, calendarSchema, 15 * 60 * 1000, async () => {
      const response = await fetch(
        'https://github.com/users/' +
          user +
          '/contributions?from=' +
          year +
          '-01-01&to=' +
          year +
          '-12-31',
        {
          headers: { 'Accept-Language': 'en', 'User-Agent': 'Eric-Profile' },
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) throw Error('Calendar unavailable');
      return parseContributions(await response.text(), year);
    }),
    cached('events-' + key, eventsSchema, 60 * 1000, async (previous) => {
      if (previous && previous.notBefore > Date.now()) return previous;
      const response = await api('/users/' + user + '/events/public?per_page=100', previous?.etag);
      const pollSeconds = Math.max(60, Number(response.headers.get('x-poll-interval')) || 60);
      if (response.status === 304 && previous)
        return { ...previous, pollSeconds, notBefore: Date.now() + pollSeconds * 1000 };
      if (!response.ok) throw Error('Events unavailable');
      const rows = z
        .array(
          z.object({
            id: z.string(),
            type: z.string(),
            created_at: z.string(),
            repo: z.object({ name: z.string() }),
            payload: z.record(z.string(), z.unknown()),
          }),
        )
        .parse(await response.json());
      return {
        items: rows
          .filter((row) => validRepo.test(row.repo.name))
          .map((row) => ({
            id: row.id,
            type: row.type,
            repo: row.repo.name,
            date: row.created_at,
            action:
              typeof row.payload.action === 'string'
                ? row.payload.action
                : typeof row.payload.ref === 'string'
                  ? row.payload.ref.replace('refs/heads/', '')
                  : '',
          })),
        etag: response.headers.get('etag'),
        pollSeconds,
        notBefore: Date.now() + pollSeconds * 1000,
      };
    }),
    cached('commits-' + key, z.array(commitSchema), 5 * 60 * 1000, async () => {
      const groups = await Promise.allSettled(
        recent.map(async (repo) => {
          const response = await api(
            '/repos/' +
              user +
              '/' +
              encodeURIComponent(repo.name) +
              '/commits?author=' +
              user +
              '&per_page=10',
          );
          if (response.status === 409) return [];
          if (!response.ok) throw Error('Commits unavailable');
          const rows = z
            .array(
              z.object({
                sha: z.string().regex(/^[a-f0-9]{40}$/),
                commit: z.object({
                  message: z.string(),
                  author: z.object({ date: z.string() }).nullable(),
                }),
              }),
            )
            .parse(await response.json());
          return rows.map((row) => ({
            sha: row.sha,
            repo: username + '/' + repo.name,
            message: row.commit.message.split('\n')[0],
            date: row.commit.author?.date || '',
          }));
        }),
      );
      // Keep the last complete snapshot if any selected repository failed.
      if (groups.some((group) => group.status === 'rejected'))
        throw Error('Incomplete commit history');
      return groups
        .flatMap((group) => (group.status === 'fulfilled' ? group.value : []))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30);
    }),
  ]);
  const pollSeconds = events.value?.pollSeconds || 60;
  const item = memory.get('events-' + key);
  if (item) item.expires = Math.max(item.expires, events.value?.notBefore || 0);
  return {
    calendar: calendar.value,
    events: events.value?.items || [],
    commits: commits.value || [],
    calendarStatus: calendar.status,
    eventsStatus: events.status,
    commitsStatus: commits.status,
    checkedAt: new Date().toISOString(),
    calendarUpdatedAt: calendar.at,
    eventsUpdatedAt: events.at,
    commitsUpdatedAt: commits.at,
    pollSeconds,
    commitRepositories: recent.length,
  };
}
