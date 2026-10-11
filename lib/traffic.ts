import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { isIP } from 'node:net';
import type { Database } from './database.ts';
import { credentialKey } from './credential-key.ts';

export const trafficSchema = `
CREATE TABLE IF NOT EXISTS traffic_visits(
 id TEXT PRIMARY KEY,session_hash TEXT NOT NULL,path TEXT NOT NULL,created_at BIGINT NOT NULL,
 ip TEXT NOT NULL,user_agent TEXT NOT NULL,browser TEXT NOT NULL,device TEXT NOT NULL,os TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_created ON traffic_visits(created_at);
CREATE INDEX IF NOT EXISTS traffic_session ON traffic_visits(session_hash);
`;
const lifetime = 30 * 60_000;
const retention = 30 * 24 * 60 * 60_000;
const cookieName = 'profile-traffic';
const mac = (key: Buffer, value: string) =>
  createHmac('sha256', key)
    .update('traffic:' + value)
    .digest('hex');
export function trafficIp(request: Request, onVercel = process.env.VERCEL === '1') {
  if (!onVercel) return '';
  const ip = request.headers.get('x-vercel-forwarded-for')?.trim() || '';
  return isIP(ip) ? ip : '';
}
export function deviceInfo(ua: string) {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /(?:Firefox|FxiOS)\//.test(ua)
        ? 'Firefox'
        : /(?:Chrome|CriOS)\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Unknown';
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad/i.test(ua)
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Macintosh|Mac OS/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Unknown';
  const device =
    /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))
      ? 'Tablet'
      : /Mobile|iPhone/i.test(ua)
        ? 'Mobile'
        : 'Desktop';
  return { browser, os, device };
}
function encryptIp(key: Buffer, ip: string) {
  if (!ip) return '';
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('profile-traffic-ip:v1'));
  const bytes = Buffer.concat([cipher.update(ip), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map((v) => v.toString('base64')).join('.');
}
function decryptIp(key: Buffer, encoded: string) {
  if (!encoded) return '';
  try {
    const [iv, tag, bytes] = encoded.split('.').map((v) => Buffer.from(v, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from('profile-traffic-ip:v1'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(bytes), decipher.final()]).toString();
  } catch {
    return 'Unavailable';
  }
}
export async function trafficSummary(database: Database) {
  const row = (await database.db
    .prepare(
      `SELECT COUNT(*) AS page_views,COUNT(DISTINCT session_hash) AS visits,
    COALESCE(SUM(CASE WHEN path IN ('/','/profile') THEN 1 ELSE 0 END),0) AS profile_views,
    COALESCE(SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END),0) AS today
    FROM traffic_visits`,
    )
    .get(Date.now() - 24 * 60 * 60_000)) as Record<string, string | number>;
  return {
    pageViews: Number(row.page_views),
    visits: Number(row.visits),
    profileViews: Number(row.profile_views),
    last24Hours: Number(row.today),
  };
}
export async function recordTraffic(
  database: Database,
  request: Request,
  path: string,
  production: boolean,
) {
  const now = Date.now(),
    key = credentialKey(database.directory, true);
  const provided =
    request.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1) || '';
  const parts = provided.split('.');
  const issued = Number(parts[0]);
  const payload = parts.slice(0, 2).join('.');
  const valid =
    parts.length === 3 &&
    /^\d{13}$/.test(parts[0]) &&
    /^[a-f0-9]{32}$/.test(parts[1]) &&
    /^[a-f0-9]{64}$/.test(parts[2]) &&
    issued <= now &&
    issued > now - lifetime &&
    timingSafeEqual(Buffer.from(mac(key, payload)), Buffer.from(parts[2]));
  const session = valid ? provided : `${now}.${randomBytes(16).toString('hex')}`;
  const token = valid ? session : session + '.' + mac(key, session);
  const sessionHash = mac(key, token);
  const ua = (request.headers.get('user-agent') || '').slice(0, 600);
  if (!/bot|crawler|spider|headless|preview|slurp/i.test(ua)) {
    const info = deviceInfo(ua);
    await database.db
      .prepare(`INSERT INTO traffic_visits VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
      .run(
        mac(key, sessionHash + ':' + path),
        sessionHash,
        path,
        now,
        encryptIp(key, trafficIp(request)),
        ua,
        info.browser,
        info.device,
        info.os,
      );
  }
  await scrubTraffic(database);
  return {
    summary: await trafficSummary(database),
    cookie: valid
      ? undefined
      : `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800${production ? '; Secure' : ''}`,
  };
}
export async function scrubTraffic(database: Database) {
  await database.db
    .prepare(
      `UPDATE traffic_visits SET ip='',user_agent='',browser='',device='',os=''
    WHERE created_at<? AND (ip<>'' OR user_agent<>'')`,
    )
    .run(Date.now() - retention);
}
export async function trafficDetails(database: Database, page: number, query: string) {
  await scrubTraffic(database);
  const since = Date.now() - retention;
  const pattern = '%' + query.toLowerCase().replace(/[\\%_]/g, '') + '%';
  const filter = `created_at>=? AND (LOWER(path) LIKE ? OR LOWER(browser) LIKE ? OR LOWER(device) LIKE ? OR LOWER(os) LIKE ?)`;
  const values = [since, pattern, pattern, pattern, pattern];
  const count = (await database.db
    .prepare('SELECT COUNT(*) AS total FROM traffic_visits WHERE ' + filter)
    .get(...values)) as { total: number | string };
  const rows = (await database.db
    .prepare(
      'SELECT * FROM traffic_visits WHERE ' +
        filter +
        ' ORDER BY created_at DESC,id LIMIT 50 OFFSET ?',
    )
    .all(...values, (page - 1) * 50)) as Array<{
    id: string;
    path: string;
    created_at: string | number;
    ip: string;
    user_agent: string;
    browser: string;
    device: string;
    os: string;
  }>;
  const key = credentialKey(database.directory, true);
  return {
    ...(await trafficSummary(database)),
    total: Number(count.total),
    page,
    pageSize: 50,
    entries: rows.map((row) => ({
      id: row.id,
      path: row.path,
      at: Number(row.created_at),
      ip: decryptIp(key, row.ip),
      userAgent: row.user_agent,
      browser: row.browser,
      device: row.device,
      os: row.os,
    })),
  };
}
