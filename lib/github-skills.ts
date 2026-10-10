import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export type GithubLanguage = { name: string; bytes: number; percent: number };
export type GithubSkills = {
  username: string;
  status: 'ready' | 'unavailable' | 'empty';
  languages: GithubLanguage[];
  repositories: number;
  partial: boolean;
  updatedAt: string;
};

export function rankLanguages(groups: Record<string, number>[]): GithubLanguage[] {
  const totals = new Map<string, number>();
  for (const group of groups)
    for (const [name, bytes] of Object.entries(group)) {
      if (Number.isFinite(bytes) && bytes > 0) totals.set(name, (totals.get(name) || 0) + bytes);
    }
  const total = [...totals.values()].reduce((sum, bytes) => sum + bytes, 0);
  return [...totals]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name, bytes]) => ({ name, bytes, percent: (bytes / total) * 100 }));
}

type Repository = { name: string; fork: boolean; private: boolean; size: number };
const cache = new Map<string, { expires: number; value: Promise<GithubSkills> }>();
const cachedSkills = z.object({
  username: z.string(),
  status: z.enum(['ready', 'unavailable', 'empty']),
  languages: z
    .array(
      z.object({
        name: z.string().max(100),
        bytes: z.number().positive(),
        percent: z.number().min(0).max(100),
      }),
    )
    .max(5),
  repositories: z.number().int().nonnegative(),
  partial: z.boolean(),
  updatedAt: z.iso.datetime(),
});

// Public GitHub data only. Deduplicate page requests and keep anonymous API
// traffic bounded: at most 30 owned repositories, four requests at a time.
export function getGithubSkills(username: string): Promise<GithubSkills> {
  const key = username.toLowerCase();
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value;
  const value = loadCachedSkills(username);
  cache.set(key, { expires: Date.now() + 60 * 60 * 1000, value });
  void value.then((result) => {
    if (result.status === 'unavailable')
      cache.set(key, { expires: Date.now() + 5 * 60 * 1000, value });
  });
  return value;
}

async function loadCachedSkills(username: string): Promise<GithubSkills> {
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return loadSkills(username);
  const folder = path.resolve(process.env.DATA_DIR || '.data', 'github-cache');
  const filename = path.join(folder, username.toLowerCase() + '.json');
  try {
    const saved = cachedSkills.parse(JSON.parse(await readFile(filename, 'utf8')));
    const ttl = saved.status === 'unavailable' ? 5 * 60 * 1000 : 60 * 60 * 1000;
    if (
      saved.username.toLowerCase() === username.toLowerCase() &&
      Date.now() - Date.parse(saved.updatedAt) < ttl
    )
      return saved;
  } catch {
    /* Missing or incomplete cache is safe to refresh from GitHub. */
  }
  const result = await loadSkills(username);
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(filename, JSON.stringify(result));
  } catch {
    /* Read-only deployments still work with the in-memory cache. */
  }
  return result;
}

async function loadSkills(username: string): Promise<GithubSkills> {
  const result: GithubSkills = {
    username,
    status: 'empty',
    languages: [],
    repositories: 0,
    partial: false,
    updatedAt: new Date().toISOString(),
  };
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return result;
  // One deadline covers all requests, so an unreachable service cannot hold a
  // page open indefinitely. Never trust an API-supplied URL for outbound fetches.
  const signal = AbortSignal.timeout(8000);
  async function read(path: string) {
    const response = await fetch('https://api.github.com' + path, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Eric-Profile' },
      signal,
      cache: 'no-store',
    });
    if (!response.ok) throw Error('GitHub unavailable');
    return response.json() as Promise<unknown>;
  }
  try {
    const input = await read(
      '/users/' + encodeURIComponent(username) + '/repos?per_page=100&sort=updated&type=owner',
    );
    if (!Array.isArray(input)) throw Error('Invalid repository list');
    const repos = (input as Repository[]).filter(
      (repo) => !repo.fork && !repo.private && typeof repo.name === 'string' && repo.size > 0,
    );
    const selected = repos.slice(0, 30);
    result.partial = repos.length > selected.length || input.length === 100;
    const groups: Record<string, number>[] = [];
    for (let start = 0; start < selected.length; start += 4) {
      const batch = await Promise.allSettled(
        selected.slice(start, start + 4).map(async (repo) => {
          const input = await read(
            '/repos/' +
              encodeURIComponent(username) +
              '/' +
              encodeURIComponent(repo.name) +
              '/languages',
          );
          if (!input || typeof input !== 'object' || Array.isArray(input))
            throw Error('Invalid languages');
          return Object.fromEntries(
            Object.entries(input).filter(
              (entry): entry is [string, number] => typeof entry[1] === 'number',
            ),
          );
        }),
      );
      for (const item of batch) {
        if (item.status === 'fulfilled') {
          groups.push(item.value);
          result.repositories++;
        } else result.partial = true;
      }
      if (signal.aborted) {
        result.partial = true;
        break;
      }
    }
    result.languages = rankLanguages(groups);
    result.status = result.languages.length
      ? 'ready'
      : selected.length && !groups.length
        ? 'unavailable'
        : 'empty';
  } catch {
    result.status = 'unavailable';
  }
  return result;
}
