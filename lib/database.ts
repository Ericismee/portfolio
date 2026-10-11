import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { contentSchema, type ContentState } from './schema.ts';
import { duplicateContent } from './content-management.ts';
import { initial, skills } from './seed.ts';
const httpErrorBrand = Symbol.for('profile.httpError');
export class HttpError extends Error {
  readonly [httpErrorBrand] = true;
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
// Development hot reload can leave cached database methods holding an older
// constructor. Recognize intentional HTTP errors across module generations.
export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    Reflect.get(error, httpErrorBrand) === true &&
    Number.isInteger(Reflect.get(error, 'status'))
  );
}
export function openDatabase(
  directory = process.env.DATA_DIR || path.resolve('.data'),
  connection?: DatabaseSync,
) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = connection ?? new DatabaseSync(path.join(directory, 'profile.sqlite'));
  if (!connection) {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS admins(username TEXT PRIMARY KEY,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,username TEXT NOT NULL REFERENCES admins(username),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT,body TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL);
 INSERT OR IGNORE INTO migrations VALUES(1);`);
    const seed = contentSchema.parse({
      ...initial,
      skills,
      posts: initial.posts.map((p) => ({ ...p, visibility: 'draft' })),
      projects: initial.projects.map((p) => ({ ...p, visibility: 'public' })),
    });
    // Seed once. Restarting or deploying a new build must never replace authored content.
    db.prepare('INSERT OR IGNORE INTO content VALUES(1,1,?)').run(JSON.stringify(seed));
  }
  const read = (): ContentState => {
    const r = db.prepare('SELECT version,body FROM content WHERE id=1').get() as {
      version: number;
      body: string;
    };
    return { version: r.version, data: contentSchema.parse(JSON.parse(r.body)) };
  };
  function write(input: unknown, version: number): ContentState {
    const next = contentSchema.parse(input);
    db.exec('BEGIN IMMEDIATE');
    try {
      const prev = read();
      // Reject stale browser tabs instead of silently overwriting another edit.
      if (prev.version !== version)
        throw new HttpError(
          409,
          'Content changed in another window. Reload before saving. / Nội dung đã thay đổi ở cửa sổ khác. Tải lại trước khi lưu.',
        );
      const duplicate = duplicateContent(next, prev.data);
      if (duplicate)
        throw new HttpError(
          400,
          {
            section: 'Tên mục đã tồn tại. / This section name already exists.',
            skill: 'Kỹ năng đã tồn tại. / This skill already exists.',
            project:
              'Dự án hoặc kho mã này đã được thêm. / This project or repository has already been added.',
            post: 'Bài viết trùng tiêu đề và nội dung đã tồn tại. / A post with this title and content already exists.',
            entry:
              'Nội dung cùng tiêu đề, tổ chức và thời gian đã tồn tại. / An entry with this title, organization and period already exists.',
          }[duplicate as 'section' | 'skill' | 'project' | 'post' | 'entry'],
        );
      db.prepare('INSERT INTO revisions(body,created_at) VALUES(?,?)').run(
        JSON.stringify(prev.data),
        new Date().toISOString(),
      );
      db.prepare('UPDATE content SET version=version+1,body=? WHERE id=1').run(
        JSON.stringify(next),
      );
      db.exec(
        'DELETE FROM revisions WHERE id NOT IN (SELECT id FROM revisions ORDER BY id DESC LIMIT 30)',
      );
      db.exec('COMMIT');
      return read();
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return { db, read, write, directory };
}
export type LocalDatabase = ReturnType<typeof openDatabase>;
export type SqlValue = string | number | bigint | null | Uint8Array;
export type Connection = {
  exec(sql: string): void | Promise<void>;
  prepare(sql: string): {
    get(...values: SqlValue[]): unknown | Promise<unknown>;
    all(...values: SqlValue[]): unknown[] | Promise<unknown[]>;
    run(...values: SqlValue[]): unknown | Promise<unknown>;
  };
};
export type Database = {
  db: Connection;
  read(): ContentState | Promise<ContentState>;
  write(input: unknown, version: number): ContentState | Promise<ContentState>;
  directory: string;
};
const globalDB = globalThis as typeof globalThis & {
  profileDB?: LocalDatabase;
  cloudDB?: Promise<Database>;
  profileDBSchema?: typeof contentSchema;
};
export const getDatabase = () => {
  if (process.env.DATABASE_URL) {
    return (globalDB.cloudDB ??= import('./cloud-database.ts').then(({ openCloudDatabase }) =>
      openCloudDatabase(),
    ).catch((error) => { globalDB.cloudDB = undefined; throw error; }));
  }
  if (process.env.VERCEL) throw new HttpError(503, 'Cloud database is not configured');
  if (globalDB.profileDBSchema !== contentSchema) {
    // Pages and API routes may load separate module generations. Reuse the
    // connection without closing one still used by an in-flight handler.
    const previous = globalDB.profileDB;
    globalDB.profileDB = previous ? openDatabase(previous.directory, previous.db) : undefined;
    globalDB.profileDBSchema = contentSchema;
  }
  return (globalDB.profileDB ??= openDatabase());
};
