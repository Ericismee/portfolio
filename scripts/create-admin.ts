import { createInterface } from 'node:readline/promises';
import { getDatabase } from '../lib/database.ts';
import { passwordHash } from '../lib/auth.ts';
const username = process.argv[2] || 'admin';
if (!/^[a-zA-Z0-9_-]{3,40}$/.test(username))
  throw Error('Username must have 3–40 letters, digits, underscores or hyphens');
let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('Terminal input is visible. Prefer ADMIN_PASSWORD from your secret manager.');
  password = await rl.question('Password (12–256 characters): ');
  rl.close();
}
const hash = await passwordHash(password),
  { db } = await getDatabase();
await db
  .prepare(
    'INSERT INTO admins VALUES(?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash',
  )
  .run(username, hash);
await db.prepare('DELETE FROM sessions WHERE username=?').run(username);
await db.close?.();
console.log('Administrator created or password updated: ' + username);
