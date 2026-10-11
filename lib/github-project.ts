import { z } from 'zod';
import { HttpError } from './database.ts';
import { url } from './schema.ts';

export const githubProjectQuery = z.object({
  username: z.string().regex(/^[a-zA-Z0-9-]{1,39}$/),
  repo: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .refine((v) => v !== '.' && v !== '..'),
});
export type GithubProject = {
  fields: Record<string, string>;
  ownership: 'owner' | 'fork-owner' | '';
  partial: boolean;
};
const technologies: Record<string, string> = {
  react: 'React',
  next: 'Next.js',
  vue: 'Vue',
  nuxt: 'Nuxt',
  svelte: 'Svelte',
  '@angular/core': 'Angular',
  express: 'Express',
  fastify: 'Fastify',
  '@tauri-apps/api': 'Tauri',
  electron: 'Electron',
  '@supabase/supabase-js': 'Supabase',
  surrealdb: 'SurrealDB',
  prisma: 'Prisma',
  tailwindcss: 'Tailwind CSS',
  vite: 'Vite',
};
const cache = new Map<string, { until: number; value: Promise<GithubProject> }>();

export function getGithubProject(username: string, repo: string): Promise<GithubProject> {
  githubProjectQuery.parse({ username, repo });
  const key = `${username}/${repo}`.toLowerCase();
  const found = cache.get(key);
  if (found && found.until > Date.now()) return found.value;
  if (cache.size >= 50) cache.delete(cache.keys().next().value!);
  const value = load(username, repo);
  cache.set(key, { until: Date.now() + 10 * 60_000, value });
  void value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}

async function load(username: string, repo: string): Promise<GithubProject> {
  const root = '/repos/' + encodeURIComponent(username) + '/' + encodeURIComponent(repo);
  const signal = AbortSignal.timeout(12_000);
  async function read(suffix: string): Promise<unknown> {
    const response = await fetch('https://api.github.com' + root + suffix, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Eric-Profile',
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN }
          : {}),
      },
      signal,
      redirect: 'error',
      cache: 'no-store',
    });
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
      throw new HttpError(
        429,
        'GitHub đã hết lượt truy cập tạm thời. Hãy thử lại sau. / GitHub rate limit reached. Please retry later.',
      );
    if (!response.ok)
      throw new HttpError(
        response.status === 404 ? 404 : 502,
        'Không đọc được kho mã GitHub công khai. Hãy thử lại sau. / Unable to read the public GitHub repository.',
      );
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1_000_000) {
          await reader.cancel();
          throw Error('GitHub response too large');
        }
        chunks.push(value);
      }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const meta = z
    .object({
      name: z.string().max(200),
      description: z.string().nullable(),
      language: z.string().nullable(),
      private: z.literal(false),
      fork: z.boolean(),
      archived: z.boolean(),
      default_branch: z.string().optional(),
      homepage: z.string().nullable().optional(),
      owner: z.object({ login: z.string(), type: z.string() }),
    })
    .parse(await read(''));
  const extra = await Promise.allSettled([
    read('/languages'),
    read('/readme'),
    read('/contents/package.json'),
  ]);
  const data = (i: number) => (extra[i].status === 'fulfilled' ? extra[i].value : null);
  const langs = z.record(z.string().max(100), z.number().nonnegative()).safeParse(data(0));
  const languageNames = langs.success
    ? Object.entries(langs.data)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
    : [];
  function file(input: unknown) {
    const parsed = z
      .object({ encoding: z.literal('base64'), content: z.string().max(800_000) })
      .safeParse(input);
    return parsed.success ? Buffer.from(parsed.data.content, 'base64').toString('utf8') : '';
  }
  const stack = new Set([meta.language || '', ...languageNames].filter(Boolean));
  try {
    const pkg = JSON.parse(file(data(2))) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    for (const dependency of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))
      if (Object.hasOwn(technologies, dependency)) stack.add(technologies[dependency]);
  } catch {
    /* A missing package manifest does not invalidate repository metadata. */
  }
  const rawReadme = file(data(1));
  const builtWith =
    /(?:built with|tech(?:nology)? stack|công nghệ)[^\n]*\n([\s\S]{0,1600}?)(?=\n#{1,6} |\n---|$)/i.exec(
      rawReadme,
    )?.[1] || '';
  for (const name of [
    'Next.js',
    'React',
    'FastAPI',
    'SurrealDB',
    'LangChain',
    'Docker',
    'Tauri',
    'SQLite',
    'Supabase',
  ])
    if (builtWith.toLowerCase().includes(name.toLowerCase())) stack.add(name);
  const plainReadme = rawReadme
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 6000);
  const readme = rawReadme.trim().slice(0, 30000);
  const github = `https://github.com/${encodeURIComponent(username)}/${encodeURIComponent(meta.name)}`;
  const demo = url.safeParse(meta.homepage || '');
  const summary =
    plainReadme
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .find((p) => p.length > 40 && !/^[|#>!*]/.test(p) && !p.startsWith('[')) || '';
  return {
    fields: {
      name: meta.name,
      description: (meta.description || summary.slice(0, 600)).slice(0, 30000),
      tech: meta.language || languageNames[0] || '',
      technologies: [...stack].slice(0, 60).join(', '),
      github,
      source: github + '#readme',
      demo: demo.success ? demo.data : '',
      details: readme,
      detailsFormat: 'markdown',
      detailsBase:
        github +
        '/blob/' +
        encodeURIComponent(meta.default_branch || 'HEAD') +
        '/' +
        (z.object({ path: z.string().max(1000) }).safeParse(data(1)).success
          ? String((data(1) as { path: string }).path)
              .split('/')
              .map(encodeURIComponent)
              .join('/')
          : 'README.md'),
    },
    ownership:
      meta.owner.type === 'User' && meta.owner.login.toLowerCase() === username.toLowerCase()
        ? meta.fork
          ? 'fork-owner'
          : 'owner'
        : '',
    partial: !langs.success || !readme,
  };
}
