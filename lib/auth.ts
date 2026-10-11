import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import type { Database } from './database.ts';
export type Session = { token_hash: string; username: string; csrf: string; expires: number };
export const token = () => randomBytes(32).toString('hex');
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
export async function passwordHash(password: string) {
  if (password.length < 12 || password.length > 256)
    throw Error('Password must have 12–256 characters');
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await derive(password, salt)).toString('hex');
}
export async function verifyPassword(password: string, stored: string) {
  if (password.length > 256) return false;
  const [salt, hash] = stored.split(':');
  const actual = await derive(password, salt);
  return timingSafeEqual(Buffer.from(hash, 'hex'), actual);
}
export function authService(
  database: Database,
  production = process.env.NODE_ENV === 'production',
) {
  const { db } = database,
    cookieName = production ? '__Host-profile_session' : 'profile_session';
  const cookie = (value: string, maxAge: number) =>
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? '; Secure' : ''}`;
  const session = async (request: Request): Promise<Session | null> => {
    const raw = (request.headers.get('cookie') || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1);
    return raw && /^[a-f0-9]{64}$/.test(raw)
      ? ((await db
          .prepare('SELECT * FROM sessions WHERE token_hash=? AND expires>?')
          .get(digest(raw), Date.now())) as Session) || null
      : null;
  };
  async function create(username: string) {
    await db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    const value = token(),
      csrf = token();
    await db
      .prepare('INSERT INTO sessions VALUES(?,?,?,?)')
      .run(digest(value), username, csrf, Date.now() + 43200000);
    return { cookie: cookie(value, 43200), csrf };
  }
  return { session, create, cookie };
}
