import { digest } from './auth.ts';
import { MAX_UPLOAD_BYTES } from './upload-limits.ts';
import { getGithubSkills } from './github-skills.ts';
import { getGithubProject, githubProjectQuery } from './github-project.ts';
import {
  githubCredential,
  inspectGithub,
  saveGithubCredential,
  disconnectGithub,
  accountRepositories,
} from './github-connection.ts';
import { z, ZodError } from 'zod';
import { getDatabase, HttpError, isHttpError, accountSchema, type Database } from './database.ts';
import { authService, passwordHash, verifyPassword } from './auth.ts';
import { publicContent } from './schema.ts';
import { migrateAssets, storeUpload, removeUpload } from './uploads.ts';
import { startCloudUpload, consumeCloudUpload, finishCloudUpload } from './cloud-uploads.ts';
import {
  trafficSchema,
  trafficSummary,
  trafficDetails,
  recordTraffic,
  trafficIp,
  trafficClientSchema,
  trafficFilterSchema,
  trafficDurationSchema,
  recordTrafficDuration,
} from './traffic.ts';
const envelope = z.object({ version: z.number().int().positive(), data: z.unknown() });
const restoreInput = z.object({
  id: z.number().int().positive(),
  version: z.number().int().positive(),
});
const messageInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(254),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1),
});
export async function requestBytes(request: Request, max = 8 * 1024 * 1024) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (reader)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, 'Content too large / Dữ liệu quá lớn');
      }
      chunks.push(value);
    }
  return Buffer.concat(chunks);
}
async function json(request: Request, max?: number) {
  try {
    return JSON.parse((await requestBytes(request, max)).toString()) as unknown;
  } catch (e) {
    if (isHttpError(e)) throw e;
    throw new HttpError(400, 'Invalid JSON');
  }
}
const send = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export function createApi(database: Database, production = false, origin?: string) {
  const { db } = database,
    auth = authService(database, production);
  const ready = (async () => {
    await db.exec(
      'CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL)',
    );
    await db.exec(trafficSchema);
    await db.exec(accountSchema);
  })();
  let dummy: Promise<string>;
  const rate = async (key: string, max: number) => {
    const now = Date.now();
    await db.prepare('DELETE FROM rate_limits WHERE until<=?').run(now);
    const result = (await db
      .prepare(
        `INSERT INTO rate_limits(key,count,until) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=rate_limits.count+1 RETURNING count`,
      )
      .get(key, now + 900000)) as { count: number };
    if (result.count > max)
      throw new HttpError(429, 'Too many requests. Please try later. / Vui lòng thử lại sau.');
  };
  return async function handle(request: Request): Promise<Response> {
    try {
      await ready;
      const pathname = new URL(request.url).pathname,
        method = request.method,
        session = await auth.session(request);
      if (!['GET', 'HEAD'].includes(method)) {
        if (production && !origin) throw new HttpError(503, 'PUBLIC_ORIGIN is not configured');
        if (request.headers.get('origin') !== (origin || new URL(request.url).origin))
          throw new HttpError(403, 'Invalid origin');
        if (
          pathname.startsWith('/api/admin/') &&
          (!session || request.headers.get('x-csrf-token') !== session.csrf)
        )
          throw new HttpError(403, 'Invalid session or CSRF token');
      }
      if (pathname === '/api/content' && method === 'GET')
        return send({ data: publicContent((await database.read()).data) });
      if (pathname === '/api/traffic' && method === 'GET')
        return send({ views: (await trafficSummary(database)).visits });
      if (pathname === '/api/traffic/duration' && method === 'POST') {
        const input = trafficDurationSchema.parse(await json(request, 1024));
        if (session) return send({ ok: true });
        await rate('traffic-duration:' + digest(trafficIp(request) || 'unknown'), 600);
        if (!(await recordTrafficDuration(database, input)))
          throw new HttpError(400, 'Invalid tracking token');
        return send({ ok: true });
      }
      if (pathname === '/api/traffic' && method === 'POST') {
        const input = trafficClientSchema
          .extend({ path: z.string().max(240) })
          .parse(await json(request, 4096));
        const content = publicContent((await database.read()).data);
        const paths = [
          '/',
          '/profile',
          '/projects',
          '/activity',
          '/feed',
          '/posts',
          '/search',
          '/github',
          '/contact',
          ...content.projects.map((p) => '/projects/' + encodeURIComponent(p.id)),
          ...content.posts.map((p) => '/posts/' + encodeURIComponent(p.id)),
        ];
        if (!paths.includes(input.path)) throw new HttpError(400, 'Invalid page');
        if (session) return send({ views: (await trafficSummary(database)).visits });
        await rate('traffic:' + digest(trafficIp(request) || 'unknown'), 120);
        const result = await recordTraffic(database, request, input.path, production, input);
        return send(
          {
            views: result.summary.visits,
            ...(result.trackingToken ? { trackingToken: result.trackingToken } : {}),
          },
          200,
          result.cookie ? { 'Set-Cookie': result.cookie } : {},
        );
      }
      if (pathname === '/api/session' && method === 'GET')
        return send({ authenticated: !!session, csrf: session?.csrf });
      if (pathname === '/api/login' && method === 'POST') {
        await rate('login-global', 300);
        const input = z
          .object({ username: z.string().min(1).max(40), password: z.string().max(256) })
          .parse(await json(request, 16 * 1024));
        await rate('login-account:' + digest(input.username.toLowerCase()), 30);
        const user = (await db
          .prepare('SELECT * FROM admins WHERE username=?')
          .get(input.username)) as { username: string; password_hash: string } | undefined;
        const valid = await verifyPassword(
          input.password,
          user?.password_hash ||
            (await (dummy ??= passwordHash('unused-timing-comparison-password'))),
        );
        if (!user || !valid)
          throw new HttpError(
            401,
            'Incorrect username or password / Tên đăng nhập hoặc mật khẩu không đúng',
          );
        const login = await auth.create(user.username);
        return send({ authenticated: true, csrf: login.csrf }, 200, { 'Set-Cookie': login.cookie });
      }
      if (pathname === '/api/contact' && method === 'POST') {
        await rate('contact', 30);
        const b = messageInput.parse(await json(request));
        await db
          .prepare('INSERT INTO messages(name,email,subject,message,created_at) VALUES(?,?,?,?,?)')
          .run(b.name, b.email, b.subject, b.message, new Date().toISOString());
        return send({ saved: true }, 201);
      }
      if (pathname.startsWith('/api/admin/')) {
        if (!session) throw new HttpError(401, 'Please sign in / Vui lòng đăng nhập');
        if (pathname === '/api/admin/account' && method === 'GET') {
          const profile = (await db
            .prepare('SELECT email FROM admin_profiles WHERE username=?')
            .get(session.username)) as { email: string } | undefined;
          return send({ username: session.username, email: profile?.email || '' });
        }
        if (pathname === '/api/admin/account' && method === 'PUT') {
          await rate('account-change:' + digest(session.username), 10);
          const input = z
            .object({
              username: z
                .string()
                .trim()
                .min(1)
                .max(40)
                .regex(/^[A-Za-z0-9._-]+$/),
              email: z.union([z.email().max(254), z.literal('')]),
              currentPassword: z.string().min(1).max(256),
              newPassword: z.union([z.string().min(12).max(256), z.literal('')]),
              confirmPassword: z.string().max(256),
            })
            .parse(await json(request, 4096));
          if (input.newPassword !== input.confirmPassword)
            throw new HttpError(400, 'Passwords do not match / Mật khẩu xác nhận không khớp');
          const user = (await db
            .prepare('SELECT password_hash FROM admins WHERE username=?')
            .get(session.username)) as { password_hash: string } | undefined;
          if (!user || !(await verifyPassword(input.currentPassword, user.password_hash)))
            throw new HttpError(
              400,
              'Current password is incorrect / Mật khẩu hiện tại không đúng',
            );
          await database.changeAccount({
            current: session.username,
            sessionHash: session.token_hash,
            expectedHash: user.password_hash,
            username: input.username,
            email: input.email,
            passwordHash: input.newPassword
              ? await passwordHash(input.newPassword)
              : user.password_hash,
          });
          const rotated = await auth.create(input.username);
          return send({ username: input.username, email: input.email, csrf: rotated.csrf }, 200, {
            'Set-Cookie': rotated.cookie,
          });
        }
        if (pathname === '/api/admin/traffic' && method === 'GET') {
          const params = new URL(request.url).searchParams;
          const page = z.coerce
            .number()
            .int()
            .min(1)
            .max(100000)
            .parse(params.get('page') || 1);
          const query = z
            .string()
            .max(100)
            .parse(params.get('q') || '');
          const filters = trafficFilterSchema.parse(
            Object.fromEntries(
              ['from', 'to', 'country', 'browser', 'device', 'os', 'path', 'ip']
                .filter((key) => params.has(key))
                .map((key) => [key, params.get(key)]),
            ),
          );
          return send(await trafficDetails(database, page, query, filters));
        }
        if (pathname === '/api/admin/upload-init' && method === 'POST') {
          await rate('upload-init', 60);
          if (database.directory !== 'cloud') return send({ mode: 'local' });
          return send(
            await startCloudUpload(database, session.username, await json(request, 4096)),
          );
        }
        if (pathname === '/api/admin/upload-finish' && method === 'POST') {
          if (database.directory !== 'cloud') throw new HttpError(404, 'Not found');
          const { id } = z.object({ id: z.string().max(50) }).parse(await json(request, 4096));
          return send({ url: await finishCloudUpload(database, session.username, id) }, 201);
        }
        if (
          ['/api/admin/import-blob', '/api/admin/content-blob'].includes(pathname) &&
          method === 'POST'
        ) {
          if (database.directory !== 'cloud') throw new HttpError(404, 'Not found');
          const { id, version } = z
            .object({ id: z.string().max(50), version: z.number().int().positive() })
            .parse(await json(request, 4096));
          const { bytes, mime } = await consumeCloudUpload(database, session.username, id);
          if (mime !== 'application/json') throw new HttpError(400, 'Expected JSON import');
          let input: unknown;
          try {
            input = JSON.parse(bytes.toString());
          } catch {
            throw new HttpError(400, 'Invalid JSON');
          }
          if (pathname === '/api/admin/content-blob')
            return send(await database.write(input, version));
          const created: string[] = [];
          try {
            return send(
              await database.write(
                await migrateAssets(input, database.directory, created),
                version,
              ),
            );
          } catch (error) {
            await Promise.allSettled(created.map((url) => removeUpload(database.directory, url)));
            throw error;
          }
        }
        if (pathname === '/api/admin/github-connection') {
          if (method === 'GET') {
            const credential = await githubCredential(database);
            return send({
              connected: !!credential.token,
              login: credential.login,
              source: credential.source,
            });
          }
          if (method === 'POST') {
            await rate('github-connect', 10);
            const { token } = z
              .object({
                token: z
                  .string()
                  .trim()
                  .min(20)
                  .max(255)
                  .regex(/^[a-zA-Z0-9_]+$/),
              })
              .parse(await json(request));
            const account = await inspectGithub(token);
            await saveGithubCredential(database, token, account.login);
            return send({ connected: true, source: 'account', ...account });
          }
          if (method === 'DELETE') {
            await disconnectGithub(database);
            const credential = await githubCredential(database);
            return send({
              connected: !!credential.token,
              login: credential.login,
              source: credential.source,
            });
          }
        }
        if (pathname === '/api/admin/github-repositories' && method === 'GET') {
          const credential = await githubCredential(database);
          if (!credential.token)
            throw new HttpError(400, 'Hãy kết nối tài khoản GitHub trước. / Connect GitHub first.');
          return send(await accountRepositories(credential.token));
        }
        if (pathname === '/api/admin/logout' && method === 'POST') {
          await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
          return send({ ok: true }, 200, { 'Set-Cookie': auth.cookie('', 0) });
        }
        if (pathname === '/api/admin/github' && method === 'GET') {
          const username = z
            .string()
            .max(39)
            .regex(/^[a-zA-Z0-9-]*$/)
            .parse(
              new URL(request.url).searchParams.get('username') ??
                (await database.read()).data.githubUsername,
            );
          return send(await getGithubSkills(username));
        }
        if (pathname === '/api/admin/github-project' && method === 'GET') {
          const query = new URL(request.url).searchParams;
          const input = githubProjectQuery.parse({
            username: query.get('username'),
            repo: query.get('repo'),
          });
          try {
            const credential = await githubCredential(database);
            const project = await getGithubProject(
              input.username,
              input.repo,
              credential.token,
              true,
            );
            return send({
              ...project,
              ownership:
                credential.token && credential.login.toLowerCase() !== input.username.toLowerCase()
                  ? ''
                  : project.ownership,
            });
          } catch (error) {
            if (isHttpError(error)) throw error;
            throw new HttpError(
              502,
              'GitHub đang bận hoặc trả dữ liệu không hợp lệ. Hãy thử lại. / GitHub is unavailable. Please retry.',
            );
          }
        }
        if (pathname === '/api/admin/content' && method === 'GET')
          return send(await database.read());
        if (pathname === '/api/admin/content' && method === 'PUT') {
          const b = envelope.parse(await json(request));
          return send(await database.write(b.data, b.version));
        }
        if (pathname === '/api/admin/import' && method === 'POST') {
          const b = envelope.parse(await json(request, MAX_UPLOAD_BYTES + 1024));
          const created: string[] = [];
          try {
            const migrated = await migrateAssets(b.data, database.directory, created);
            return send(await database.write(migrated, b.version));
          } catch (error) {
            // Only generated files from this rejected import are eligible for cleanup.
            await Promise.allSettled(created.map((url) => removeUpload(database.directory, url)));
            throw error;
          }
        }
        if (pathname === '/api/admin/upload' && method === 'POST') {
          const url = await storeUpload(
            database.directory,
            await requestBytes(request, MAX_UPLOAD_BYTES),
            request.headers.get('content-type') || '',
          );
          return send({ url }, 201);
        }
        if (pathname === '/api/admin/revisions' && method === 'GET')
          return send({
            revisions: await db
              .prepare('SELECT id,created_at FROM revisions ORDER BY id DESC')
              .all(),
          });
        if (pathname === '/api/admin/restore' && method === 'POST') {
          const b = restoreInput.parse(await json(request)),
            r = (await db.prepare('SELECT body FROM revisions WHERE id=?').get(b.id)) as
              { body: string } | undefined;
          if (!r) throw new HttpError(404, 'Revision not found');
          return send(await database.write(JSON.parse(r.body), b.version));
        }
        if (pathname === '/api/admin/messages' && method === 'GET')
          return send({
            messages: await db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all(),
          });
        if (pathname === '/api/admin/messages' && method === 'DELETE') {
          const b = z.object({ id: z.number().int().positive() }).parse(await json(request));
          await db.prepare('DELETE FROM messages WHERE id=?').run(b.id);
          return send({ ok: true });
        }
      }
      return send({ error: 'Not found' }, 404);
    } catch (e) {
      if (e instanceof ZodError)
        return send(
          {
            error: e.issues
              .slice(0, 5)
              .map((i) => i.path.join('.') + ': ' + i.message)
              .join('\n'),
          },
          400,
        );
      if (isHttpError(e)) return send({ error: e.message }, e.status);
      // Database/provider errors can contain SQL values or connection details.
      console.error('API request failed:', e instanceof Error ? e.name : 'Unknown error');
      return send({ error: 'Server error / Lỗi máy chủ' }, 500);
    }
  };
}
const apiGlobal = globalThis as typeof globalThis & {
  profileAPI?: ReturnType<typeof createApi>;
  profileAPIFactory?: typeof createApi;
};
export const handleApi = async (request: Request) => {
  if (apiGlobal.profileAPIFactory !== createApi) {
    apiGlobal.profileAPI = undefined;
    apiGlobal.profileAPIFactory = createApi;
  }
  return (apiGlobal.profileAPI ??= createApi(
    await getDatabase(),
    process.env.NODE_ENV === 'production',
    process.env.PUBLIC_ORIGIN,
  ))(request);
};
