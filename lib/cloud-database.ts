import postgres from 'postgres';
import {
  HttpError,
  accountSchema,
  type Connection,
  type Database,
  type SqlValue,
} from './database.ts';
import { contentSchema, type ContentState } from './schema.ts';
import { duplicateContent } from './content-management.ts';
import { initial, skills } from './seed.ts';

// SQL text is application-owned. Values are always bound separately.
export function postgresParameters(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => '$' + ++index);
}
export function connection(sql: postgres.Sql): Connection {
  const execute = (text: string, values: SqlValue[] = []) =>
    sql.unsafe(postgresParameters(text), values as never[]);
  return {
    close: () => sql.end(),
    exec: async (text) => {
      await sql.unsafe(text);
    },
    prepare: (text) => ({
      get: async (...values) => (await execute(text, values))[0],
      all: async (...values) => Array.from(await execute(text, values)),
      run: async (...values) => {
        await execute(text, values);
      },
    }),
  };
}
export async function openCloudDatabase(url = process.env.DATABASE_URL!): Promise<Database> {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw Error('Invalid database URL');
  const sql = postgres(url, {
    ssl: { rejectUnauthorized: true },
    max: 2,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
  return createCloudDatabase(sql);
}
export const cloudSchema = `
    CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admins(username TEXT PRIMARY KEY,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,username TEXT NOT NULL REFERENCES admins(username),csrf TEXT NOT NULL,expires BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS revisions(id SERIAL PRIMARY KEY,body TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id SERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS github_connection(id INTEGER PRIMARY KEY CHECK(id=1),secret TEXT NOT NULL,login TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS upload_intents(id TEXT PRIMARY KEY,username TEXT NOT NULL REFERENCES admins(username),mime TEXT NOT NULL,size INTEGER NOT NULL,expires BIGINT NOT NULL);
  `;
export async function createCloudDatabase(sql: postgres.Sql): Promise<Database> {
  await sql.unsafe(cloudSchema);
  await sql.unsafe(accountSchema);
  const seed = contentSchema.parse({
    ...initial,
    skills,
    posts: initial.posts.map((p) => ({ ...p, visibility: 'draft' })),
  });
  await sql`INSERT INTO content VALUES(1,1,${JSON.stringify(seed)}) ON CONFLICT(id) DO NOTHING`;
  const db = connection(sql);
  const read = async (): Promise<ContentState> => {
    const [row] = await sql`SELECT version,body FROM content WHERE id=1`;
    return { version: row.version, data: contentSchema.parse(JSON.parse(row.body)) };
  };
  return {
    db,
    directory: 'cloud',
    read,
    async changeAccount(input) {
      try {
        await sql.begin(async (tx) => {
          const [row] =
            await tx`SELECT password_hash FROM admins WHERE username=${input.current} FOR UPDATE`;
          if (!row || row.password_hash !== input.expectedHash)
            throw new HttpError(
              409,
              'Account changed. Sign in again. / Tài khoản đã thay đổi. Vui lòng đăng nhập lại.',
            );
          if (
            !(
              await tx`SELECT token_hash FROM sessions WHERE token_hash=${input.sessionHash} AND username=${input.current} AND expires>${Date.now()}`
            ).length
          )
            throw new HttpError(
              409,
              'Account session changed. Sign in again. / Phiên tài khoản đã thay đổi. Vui lòng đăng nhập lại.',
            );
          if (
            (
              await tx`SELECT username FROM admins WHERE LOWER(username)=LOWER(${input.username}) AND username<>${input.current}`
            ).length
          )
            throw new HttpError(409, 'Username already exists / Tên đăng nhập đã tồn tại');
          if (input.username !== input.current)
            await tx`INSERT INTO admins VALUES(${input.username},${input.passwordHash})`;
          else
            await tx`UPDATE admins SET password_hash=${input.passwordHash} WHERE username=${input.current}`;
          await tx`DELETE FROM sessions WHERE username=${input.current}`;
          await tx`DELETE FROM admin_profiles WHERE username=${input.current}`;
          await tx`INSERT INTO admin_profiles VALUES(${input.username},${input.email})`;
          if (input.username !== input.current) {
            await tx`UPDATE admin_mfa SET username=${input.username} WHERE username=${input.current}`;
            await tx`UPDATE upload_intents SET username=${input.username} WHERE username=${input.current}`;
            await tx`DELETE FROM admins WHERE username=${input.current}`;
          }
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
          throw new HttpError(409, 'Username already exists / Tên đăng nhập đã tồn tại');
        throw error;
      }
    },
    async write(input, version) {
      const next = contentSchema.parse(input);
      await sql.begin(async (tx) => {
        const [prev] = await tx`SELECT version,body FROM content WHERE id=1 FOR UPDATE`;
        if (prev.version !== version)
          throw new HttpError(
            409,
            'Content changed in another window. Reload before saving. / Nội dung đã thay đổi. Tải lại trước khi lưu.',
          );
        const duplicate = duplicateContent(next, contentSchema.parse(JSON.parse(prev.body)));
        if (duplicate)
          throw new HttpError(400, 'This content already exists. / Nội dung này đã tồn tại.');
        await tx`INSERT INTO revisions(body,created_at) VALUES(${prev.body},${new Date().toISOString()})`;
        await tx`UPDATE content SET version=version+1,body=${JSON.stringify(next)} WHERE id=1`;
        await tx`DELETE FROM revisions WHERE id NOT IN (SELECT id FROM revisions ORDER BY id DESC LIMIT 30)`;
      });
      return read();
    },
  };
}
