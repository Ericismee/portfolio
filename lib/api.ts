import { getGithubSkills } from './github-skills.ts';
import { z, ZodError } from 'zod';
import { getDatabase, HttpError, type Database } from './database.ts';
import { authService, passwordHash, verifyPassword } from './auth.ts';
import { publicContent } from './schema.ts';
import { migrateAssets, storeUpload } from './uploads.ts';
const envelope = z.object({ version: z.number().int().positive(), data: z.unknown() });
const restoreInput = z.object({
  id: z.number().int().positive(),
  version: z.number().int().positive(),
});
const messageInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(254),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(10000),
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
async function json(request: Request) {
  try {
    return JSON.parse((await requestBytes(request)).toString()) as unknown;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'Invalid JSON');
  }
}
const send = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export function createApi(database: Database, production = false, origin?: string) {
  const { db } = database,
    auth = authService(database, production),
    limits = new Map<string, { count: number; until: number }>();
  let dummy: Promise<string>;
  const rate = (key: string, max: number) => {
    const now = Date.now();
    let r = limits.get(key);
    if (!r || r.until < now) {
      r = { count: 0, until: now + 900000 };
      limits.set(key, r);
    }
    if (++r.count > max)
      throw new HttpError(429, 'Too many requests. Please try later. / Vui lòng thử lại sau.');
  };
  return async function handle(request: Request): Promise<Response> {
    try {
      const pathname = new URL(request.url).pathname,
        method = request.method,
        session = auth.session(request);
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
        return send({ data: publicContent(database.read().data) });
      if (pathname === '/api/session' && method === 'GET')
        return send({ authenticated: !!session, csrf: session?.csrf });
      if (pathname === '/api/login' && method === 'POST') {
        rate('login', 30);
        const input = z
          .object({ username: z.string().min(1).max(40), password: z.string().max(256) })
          .parse(await json(request));
        const user = db.prepare('SELECT * FROM admins WHERE username=?').get(input.username) as
          { username: string; password_hash: string } | undefined;
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
        const login = auth.create(user.username);
        return send({ authenticated: true, csrf: login.csrf }, 200, { 'Set-Cookie': login.cookie });
      }
      if (pathname === '/api/contact' && method === 'POST') {
        rate('contact', 30);
        const b = messageInput.parse(await json(request));
        db.prepare(
          'INSERT INTO messages(name,email,subject,message,created_at) VALUES(?,?,?,?,?)',
        ).run(b.name, b.email, b.subject, b.message, new Date().toISOString());
        return send({ saved: true }, 201);
      }
      if (pathname.startsWith('/api/admin/')) {
        if (!session) throw new HttpError(401, 'Please sign in / Vui lòng đăng nhập');
        if (pathname === '/api/admin/logout' && method === 'POST') {
          db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
          return send({ ok: true }, 200, { 'Set-Cookie': auth.cookie('', 0) });
        }
        if (pathname === '/api/admin/github' && method === 'GET') {
          const username = z
            .string()
            .max(39)
            .regex(/^[a-zA-Z0-9-]*$/)
            .parse(
              new URL(request.url).searchParams.get('username') ??
                database.read().data.githubUsername,
            );
          return send(await getGithubSkills(username));
        }
        if (pathname === '/api/admin/content' && method === 'GET') return send(database.read());
        if (pathname === '/api/admin/content' && method === 'PUT') {
          const b = envelope.parse(await json(request));
          return send(database.write(b.data, b.version));
        }
        if (pathname === '/api/admin/import' && method === 'POST') {
          const b = envelope.parse(await json(request));
          return send(database.write(await migrateAssets(b.data, database.directory), b.version));
        }
        if (pathname === '/api/admin/upload' && method === 'POST') {
          const url = await storeUpload(
            database.directory,
            await requestBytes(request, 3 * 1024 * 1024),
            request.headers.get('content-type') || '',
          );
          return send({ url }, 201);
        }
        if (pathname === '/api/admin/revisions' && method === 'GET')
          return send({
            revisions: db.prepare('SELECT id,created_at FROM revisions ORDER BY id DESC').all(),
          });
        if (pathname === '/api/admin/restore' && method === 'POST') {
          const b = restoreInput.parse(await json(request)),
            r = db.prepare('SELECT body FROM revisions WHERE id=?').get(b.id) as
              { body: string } | undefined;
          if (!r) throw new HttpError(404, 'Revision not found');
          return send(database.write(JSON.parse(r.body), b.version));
        }
        if (pathname === '/api/admin/messages' && method === 'GET')
          return send({
            messages: db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all(),
          });
        if (pathname === '/api/admin/messages' && method === 'DELETE') {
          const b = z.object({ id: z.number().int().positive() }).parse(await json(request));
          db.prepare('DELETE FROM messages WHERE id=?').run(b.id);
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
      if (e instanceof HttpError) return send({ error: e.message }, e.status);
      console.error('API request failed:', e instanceof Error ? e.name : 'Unknown error');
      return send({ error: 'Server error / Lỗi máy chủ' }, 500);
    }
  };
}
const apiGlobal = globalThis as typeof globalThis & { profileAPI?: ReturnType<typeof createApi> };
export const handleApi = (request: Request) =>
  (apiGlobal.profileAPI ??= createApi(
    getDatabase(),
    process.env.NODE_ENV === 'production',
    process.env.PUBLIC_ORIGIN,
  ))(request);
