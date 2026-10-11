import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDatabase, HttpError, type Database } from './database.ts';

// Credentials live outside content, revisions, public responses and backup exports.
function table(database: Database) {
  database.db.exec(
    'CREATE TABLE IF NOT EXISTS github_connection(id INTEGER PRIMARY KEY CHECK(id=1), secret TEXT NOT NULL, login TEXT NOT NULL)',
  );
}
function key(database: Database) {
  const filename = path.join(database.directory, 'github-credential.key');
  try {
    return readFileSync(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try {
      writeFileSync(filename, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    return readFileSync(filename);
  }
}
export function githubCredential(database?: Database) {
  if (!database && !existsSync(path.resolve(process.env.DATA_DIR || '.data', 'profile.sqlite')))
    return {
      token: process.env.GITHUB_TOKEN || '',
      login: '',
      source: process.env.GITHUB_TOKEN ? ('environment' as const) : ('none' as const),
    };
  database ??= getDatabase();
  table(database);
  const row = database.db.prepare('SELECT secret,login FROM github_connection WHERE id=1').get() as
    { secret: string; login: string } | undefined;
  if (row) {
    const [iv, tag, body] = row.secret.split('.').map((v) => Buffer.from(v, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key(database), iv);
    decipher.setAuthTag(tag);
    return {
      token: Buffer.concat([decipher.update(body), decipher.final()]).toString(),
      login: row.login,
      source: 'account' as const,
    };
  }
  return {
    token: process.env.GITHUB_TOKEN || '',
    login: '',
    source: process.env.GITHUB_TOKEN ? ('environment' as const) : ('none' as const),
  };
}
export function saveGithubCredential(database: Database, token: string, login: string) {
  table(database);
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(database), iv);
  const body = Buffer.concat([cipher.update(token), cipher.final()]);
  const secret = [iv, cipher.getAuthTag(), body].map((v) => v.toString('base64')).join('.');
  database.db.prepare('INSERT OR REPLACE INTO github_connection VALUES(1,?,?)').run(secret, login);
}
export function disconnectGithub(database: Database) {
  table(database);
  database.db.prepare('DELETE FROM github_connection WHERE id=1').run();
}
export function githubHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Eric-Profile',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  };
}
export function githubIdentity(token: string) {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}
export async function githubRead(route: string, token: string) {
  let response: Response;
  try {
    response = await fetch('https://api.github.com' + route, {
      headers: githubHeaders(token),
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
      cache: 'no-store',
    });
  } catch {
    throw new HttpError(
      502,
      'Không kết nối được GitHub. Hãy thử lại. / Unable to connect to GitHub.',
    );
  }
  if (response.status === 401)
    throw new HttpError(
      400,
      'Token GitHub không hợp lệ hoặc đã hết hạn. / Invalid or expired GitHub token.',
    );
  if (!response.ok) {
    if (
      response.status === 429 ||
      (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
    ) {
      const reset = Number(response.headers.get('x-ratelimit-reset'));
      const at = reset > 0 ? new Date(reset * 1000).toISOString() : '';
      throw new HttpError(
        429,
        'GitHub tạm hết lượt truy cập. ' +
          (at ? 'Thử lại sau ' + at + '. ' : '') +
          'Kết nối tài khoản GitHub để dùng hạn mức riêng.',
      );
    }
    throw new HttpError(
      response.status === 404 ? 404 : 502,
      'Không đọc được GitHub. Kiểm tra quyền truy cập của token. / Check GitHub token permissions.',
    );
  }
  return response;
}
export async function inspectGithub(token: string) {
  const response = await githubRead('/user', token);
  const user = (await response.json()) as { login?: unknown };
  if (typeof user.login !== 'string' || !/^[a-zA-Z0-9-]{1,39}$/.test(user.login))
    throw new HttpError(502, 'Invalid GitHub account');
  return {
    login: user.login,
    remaining: Number(response.headers.get('x-ratelimit-remaining')),
    limit: Number(response.headers.get('x-ratelimit-limit')),
    reset: Number(response.headers.get('x-ratelimit-reset')),
  };
}
const repositoryCache = new Map<
  string,
  { until: number; value: ReturnType<typeof loadAccountRepositories> }
>();
export function accountRepositories(token: string) {
  const id = githubIdentity(token),
    cached = repositoryCache.get(id);
  if (cached && cached.until > Date.now()) return cached.value;
  if (repositoryCache.size >= 20) repositoryCache.delete(repositoryCache.keys().next().value!);
  const value = loadAccountRepositories(token);
  repositoryCache.set(id, { until: Date.now() + 5 * 60_000, value });
  void value.catch(() => {
    if (repositoryCache.get(id)?.value === value) repositoryCache.delete(id);
  });
  return value;
}
async function loadAccountRepositories(token: string) {
  const repos: {
    name: string;
    fullName: string;
    language: string | null;
    private: boolean;
    fork: boolean;
  }[] = [];
  for (let page = 1; page <= 10; page++) {
    const response = await githubRead(
      '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=' +
        page,
      token,
    );
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new HttpError(502, 'Invalid GitHub repositories');
    for (const repo of data)
      if (
        typeof repo.full_name === 'string' &&
        /^[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(repo.full_name)
      )
        repos.push({
          name: repo.name,
          fullName: repo.full_name,
          language: repo.language,
          private: repo.private === true,
          fork: repo.fork === true,
        });
    if (data.length < 100) return { repos, partial: false };
  }
  return { repos, partial: true };
}
