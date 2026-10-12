import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { credentialKey } from './credential-key.ts';
import type { Database } from './database.ts';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newMfaSecret() {
  const bytes = randomBytes(20);
  let bits = 0,
    value = 0,
    encoded = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      encoded += alphabet[(value >>> bits) & 31];
    }
  }
  return encoded;
}
export function totp(secret: string, step: number) {
  let bits = 0,
    value = 0;
  const bytes: number[] = [];
  for (const char of secret) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
export function mfaStep(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30_000);
  for (const candidate of [step, step - 1, step + 1])
    if (candidate >= 0 && timingSafeEqual(Buffer.from(totp(secret, candidate)), Buffer.from(code)))
      return candidate;
  return null;
}
function protect(key: Buffer, secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('profile-mfa:v1'));
  const bytes = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map((part) => part.toString('base64')).join('.');
}
function reveal(key: Buffer, encoded: string) {
  const [iv, tag, bytes] = encoded.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from('profile-mfa:v1'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(bytes), decipher.final()]).toString();
}
type MfaRow = {
  secret: string;
  enabled: number;
  last_step: number;
  pending_expires: number;
  recovery_hashes: string;
};
export async function mfaState(database: Database, username: string) {
  return (await database.db.prepare('SELECT * FROM admin_mfa WHERE username=?').get(username)) as
    MfaRow | undefined;
}
export async function beginMfa(database: Database, username: string) {
  if ((await mfaState(database, username))?.enabled)
    throw Error('Two-factor authentication is already enabled');
  const secret = newMfaSecret();
  await database.db
    .prepare(
      'INSERT INTO admin_mfa VALUES(?,?,0,-1,?,?) ON CONFLICT(username) DO UPDATE SET secret=excluded.secret,pending_expires=excluded.pending_expires WHERE admin_mfa.enabled=0',
    )
    .run(
      username,
      protect(credentialKey(database.directory, true), secret),
      Date.now() + 10 * 60_000,
      '[]',
    );
  return {
    secret,
    uri: `otpauth://totp/${encodeURIComponent('Eric Profile:' + username)}?secret=${secret}&issuer=Eric%20Profile&algorithm=SHA1&digits=6&period=30`,
  };
}
export async function confirmMfa(database: Database, username: string, code: string) {
  const row = await mfaState(database, username);
  if (!row || row.enabled || Number(row.pending_expires) < Date.now()) return null;
  const step = mfaStep(reveal(credentialKey(database.directory, true), row.secret), code);
  if (step === null) return null;
  const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(8).toString('hex'));
  const saved = await database.db
    .prepare(
      'UPDATE admin_mfa SET enabled=1,last_step=?,pending_expires=0,recovery_hashes=? WHERE username=? AND enabled=0 AND secret=? AND pending_expires>? RETURNING username',
    )
    .get(step, JSON.stringify(recoveryCodes.map(recoveryHash)), username, row.secret, Date.now());
  return saved ? recoveryCodes : null;
}
const recoveryHash = (code: string) =>
  createHash('sha256')
    .update('profile-mfa-recovery:' + code.toLowerCase().replace(/[-\s]/g, ''))
    .digest('hex');
export async function verifyMfa(database: Database, username: string, code: string) {
  const row = await mfaState(database, username);
  if (!row?.enabled) return true;
  const key = credentialKey(database.directory, true);
  const step = mfaStep(reveal(key, row.secret), code);
  if (step !== null && step > Number(row.last_step)) {
    return !!(await database.db
      .prepare(
        'UPDATE admin_mfa SET last_step=? WHERE username=? AND enabled=1 AND last_step<? AND secret=? RETURNING username',
      )
      .get(step, username, step, row.secret));
  }
  if (!/^[a-f0-9-\s]{16,24}$/i.test(code)) return false;
  const hashes = JSON.parse(row.recovery_hashes) as string[];
  const hash = recoveryHash(code);
  if (!hashes.includes(hash)) return false;
  return !!(await database.db
    .prepare(
      'UPDATE admin_mfa SET recovery_hashes=? WHERE username=? AND enabled=1 AND recovery_hashes=? RETURNING username',
    )
    .get(JSON.stringify(hashes.filter((item) => item !== hash)), username, row.recovery_hashes));
}
