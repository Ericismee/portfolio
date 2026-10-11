import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { githubCredential, githubHeaders, githubIdentity } from './github-connection.ts';

export type GithubLanguage = { name: string; bytes: number; percent: number };
const repoSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stars: z.number().nonnegative(),
  forks: z.number().nonnegative(),
  fork: z.boolean(),
  archived: z.boolean(),
  updatedAt: z.string(),
  topics: z.array(z.string()),
});
const profileSchema = z.object({
  avatarUrl: z.string().default(''),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  company: z.string().nullable(),
  followers: z.number().nonnegative(),
  following: z.number().nonnegative(),
  publicRepos: z.number().nonnegative(),
  createdAt: z.string(),
});
export type GithubSkills = {
  profile: z.infer<typeof profileSchema> | null;
  repos: z.infer<typeof repoSchema>[];
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
    .map(([name, bytes]) => ({ name, bytes, percent: (bytes / total) * 100 }));
}

type Repository = {
  name: string;
  description: string | null;
  language: string | null;
  fork: boolean;
  private: boolean;
  size: number;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  topics?: string[];
};
const cache = new Map<string, { expires: number; value: Promise<GithubSkills> }>();
const cachedSkills = z.object({
  format: z.literal(2),
  profile: profileSchema.nullable(),
  repos: z.array(repoSchema),
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
    .max(100),
  repositories: z.number().int().nonnegative(),
  partial: z.boolean(),
  updatedAt: z.iso.datetime(),
});

// Public GitHub data only. Deduplicate page requests and keep anonymous API
// traffic bounded: paginated public repositories and four language requests at a time.
export async function getGithubSkills(username: string): Promise<GithubSkills> {
  const key = username.toLowerCase() + '-' + githubIdentity((await githubCredential()).token);
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value;
  const value = loadCachedSkills(username);
  cache.set(key, { expires: Date.now() + 60 * 60 * 1000, value });
  void value.then((result) => {
    cache.set(key, {
      expires:
        Date.parse(result.updatedAt) + (result.status === 'unavailable' ? 5 : 60) * 60 * 1000,
      value,
    });
  });
  return value;
}

async function loadCachedSkills(username: string): Promise<GithubSkills> {
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return loadSkills(username);
  const folder = path.resolve(process.env.DATA_DIR || '.data', 'github-cache');
  const filename = path.join(
    folder,
    username.toLowerCase() + '-' + githubIdentity((await githubCredential()).token) + '.json',
  );
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
    await writeFile(filename, JSON.stringify({ ...result, format: 2 }));
  } catch {
    /* Read-only deployments still work with the in-memory cache. */
  }
  return result;
}

async function loadSkills(username: string): Promise<GithubSkills> {
  const result: GithubSkills = {
    username,
    profile: null,
    repos: [],
    status: 'empty',
    languages: [],
    repositories: 0,
    partial: false,
    updatedAt: new Date().toISOString(),
  };
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return result;
  // One deadline covers all requests, so an unreachable service cannot hold a
  // page open indefinitely. Never trust an API-supplied URL for outbound fetches.
  const signal = AbortSignal.timeout(12000);
  const token = (await githubCredential()).token;
  let rateLimited = false;
  async function read(path: string) {
    if (rateLimited) throw Error('GitHub rate limit reached');
    const response = await fetch('https://api.github.com' + path, {
      headers: githubHeaders(token),
      signal,
      redirect: 'error',
      cache: 'no-store',
    });
    if (response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0')
      rateLimited = true;
    if (!response.ok) throw Error('GitHub unavailable');
    return response.json() as Promise<unknown>;
  }
  try {
    const userPath = '/users/' + encodeURIComponent(username);
    // User profile failure does not discard a successfully fetched repository list.
    try {
      const user = (await read(userPath)) as Record<string, unknown>;
      result.profile = profileSchema.parse({
        name: user.name,
        bio: user.bio,
        location: user.location,
        company: user.company,
        followers: user.followers,
        following: user.following,
        publicRepos: user.public_repos,
        createdAt: user.created_at,
        avatarUrl:
          typeof user.avatar_url === 'string' &&
          /^https:\/\/avatars\.githubusercontent\.com\//.test(user.avatar_url)
            ? user.avatar_url
            : '',
      });
    } catch {
      result.partial = true;
    }
    const all: Repository[] = [];
    for (let page = 1; page <= 10; page++) {
      try {
        const input = await read(
          userPath + '/repos?per_page=100&sort=updated&type=owner&page=' + page,
        );
        if (!Array.isArray(input)) throw Error('Invalid repository list');
        all.push(
          ...(input as Repository[]).filter(
            (repo) => !repo.private && typeof repo.name === 'string',
          ),
        );
        if (input.length < 100) break;
        if (page === 10) result.partial = true;
      } catch {
        if (!all.length) throw Error('GitHub unavailable');
        result.partial = true;
        break;
      }
    }
    result.repos = all.map((repo) =>
      repoSchema.parse({
        name: repo.name,
        description: repo.description ?? null,
        language: repo.language ?? null,
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        fork: repo.fork,
        archived: repo.archived ?? false,
        updatedAt: repo.updated_at ?? '',
        topics: repo.topics ?? [],
      }),
    );
    const selected = all.filter((repo) => !repo.fork && repo.size > 0);
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
      if (signal.aborted || rateLimited) {
        result.partial = true;
        break;
      }
    }
    result.languages = rankLanguages(groups);
    result.status =
      result.languages.length || result.repos.length || result.profile
        ? 'ready'
        : selected.length && !groups.length
          ? 'unavailable'
          : 'empty';
  } catch {
    result.status = 'unavailable';
  }
  return result;
}
