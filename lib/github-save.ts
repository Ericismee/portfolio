import type { Content, ContentState, GithubSettings } from './schema';
import { request, RequestError } from './client.ts';

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const conflict = () =>
  new RequestError(
    'Cấu hình GitHub này cũng đã được sửa ở cửa sổ khác. Lựa chọn của bạn vẫn được giữ bên dưới. / GitHub settings were also edited elsewhere. Your choices are preserved.',
    409,
  );

export function mergeGithubChanges(
  base: Content,
  latest: Content,
  settings: GithubSettings,
  username: string,
  resolve = false,
): Content {
  const next = structuredClone(latest);
  if (latest.githubUsername !== base.githubUsername && latest.githubUsername !== username) {
    if (!resolve) throw conflict();
    next.githubUsername = username;
    next.github = structuredClone(settings);
    return next;
  }
  if (username !== base.githubUsername) {
    if (!resolve && !equal(latest.github, base.github) && !equal(latest.github, settings))
      throw conflict();
    next.githubUsername = username;
    next.github = structuredClone(settings);
    return next;
  }
  for (const key of Object.keys(settings) as (keyof GithubSettings)[]) {
    if (equal(settings[key], base.github[key])) continue;
    if (key === 'hiddenRepos') {
      const hidden = new Map(latest.github.hiddenRepos.map((name) => [name.toLowerCase(), name]));
      const before = new Set(base.github.hiddenRepos.map((name) => name.toLowerCase()));
      const after = new Set(settings.hiddenRepos.map((name) => name.toLowerCase()));
      for (const name of base.github.hiddenRepos)
        if (!after.has(name.toLowerCase())) hidden.delete(name.toLowerCase());
      for (const name of settings.hiddenRepos)
        if (!before.has(name.toLowerCase())) hidden.set(name.toLowerCase(), name);
      next.github.hiddenRepos = [...hidden.values()];
    } else {
      if (
        !resolve &&
        !equal(latest.github[key], base.github[key]) &&
        !equal(latest.github[key], settings[key])
      )
        throw conflict();
      Object.assign(next.github, { [key]: structuredClone(settings[key]) });
    }
  }
  return next;
}
export async function saveGithubChanges(
  base: Content,
  settings: GithubSettings,
  username: string,
  csrf: string,
  resolve = false,
): Promise<ContentState> {
  // Refresh before writing and reapply only edited GitHub fields. Preserve the
  // other sections and independent repository edits from other windows.
  for (let attempt = 0; attempt < 2; attempt++) {
    const latest = await request<ContentState>('/api/admin/content');
    const data = mergeGithubChanges(base, latest.data, settings, username, resolve);
    try {
      return await request<ContentState>(
        '/api/admin/content',
        'PUT',
        { data, version: latest.version },
        csrf,
      );
    } catch (error) {
      if (!(error instanceof RequestError) || error.status !== 409 || attempt === 1) throw error;
    }
  }
  throw conflict();
}
