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
import { z } from 'zod';

export const trafficSchema = `
CREATE TABLE IF NOT EXISTS traffic_visits(
 id TEXT PRIMARY KEY,session_hash TEXT NOT NULL,path TEXT NOT NULL,created_at BIGINT NOT NULL,
 ip TEXT NOT NULL,user_agent TEXT NOT NULL,browser TEXT NOT NULL,device TEXT NOT NULL,os TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_created ON traffic_visits(created_at);
CREATE INDEX IF NOT EXISTS traffic_session ON traffic_visits(session_hash);
CREATE TABLE IF NOT EXISTS traffic_context(
 visit_id TEXT PRIMARY KEY,country TEXT NOT NULL,ip_hash TEXT NOT NULL,details TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_country ON traffic_context(country);
CREATE INDEX IF NOT EXISTS traffic_ip_lookup ON traffic_context(ip_hash);
`;
const day = 86400_000;
const analyticsOffset = 7 * 3600_000;
const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const trafficFilterSchema = z
  .object({
    from: dateInput.optional(),
    to: dateInput.optional(),
    country: z
      .string()
      .regex(/^(?:[A-Z]{2}|unknown)?$/)
      .default(''),
    browser: z.string().max(40).default(''),
    device: z.string().max(20).default(''),
    os: z.string().max(40).default(''),
    path: z.string().max(240).default(''),
    ip: z
      .string()
      .max(45)
      .refine((v) => !v || !!isIP(v))
      .default(''),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    'Invalid date range / Khoảng ngày không hợp lệ',
  );
export type TrafficFilters = z.input<typeof trafficFilterSchema>;
export const trafficClientSchema = z.object({
  timezone: z.string().max(80).default(''),
  width: z.number().int().min(0).max(20000).default(0),
  height: z.number().int().min(0).max(20000).default(0),
  screenWidth: z.number().int().min(0).max(20000).default(0),
  screenHeight: z.number().int().min(0).max(20000).default(0),
  pixelRatio: z.number().min(0).max(20).default(0),
  referrer: z.string().max(2048).default(''),
});
export function trafficGeo(request: Request, onVercel = process.env.VERCEL === '1') {
  const read = (header: string) => {
    if (!onVercel) return '';
    try {
      return decodeURIComponent(request.headers.get(header) || '')
        .split('')
        .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
        .join('')
        .slice(0, 100);
    } catch {
      return '';
    }
  };
  const country = read('x-vercel-ip-country').toUpperCase();
  const coordinate = (header: string, limit: number) => {
    const value = read(header);
    return value && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit ? value : '';
  };
  const continent = read('x-vercel-ip-continent');
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    city: read('x-vercel-ip-city'),
    region: read('x-vercel-ip-country-region'),
    continent: /^(AF|AN|AS|EU|NA|OC|SA)$/.test(continent) ? continent : '',
    latitude: coordinate('x-vercel-ip-latitude', 90),
    longitude: coordinate('x-vercel-ip-longitude', 180),
    geoTimezone: read('x-vercel-ip-timezone'),
    postalCode: read('x-vercel-ip-postal-code').slice(0, 20),
  };
}
const lifetime = 30 * 60_000;
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
function encryptIp(key: Buffer, ip: string, aad = 'profile-traffic-ip:v1') {
  if (!ip) return '';
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const bytes = Buffer.concat([cipher.update(ip), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map((v) => v.toString('base64')).join('.');
}
function decryptIp(key: Buffer, encoded: string, aad = 'profile-traffic-ip:v1') {
  if (!encoded) return '';
  try {
    const [iv, tag, bytes] = encoded.split('.').map((v) => Buffer.from(v, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(aad));
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
  client = trafficClientSchema.parse({}),
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
    const geo = trafficGeo(request);
    let referrer = '';
    try {
      const url = new URL(client.referrer);
      if (['https:', 'http:'].includes(url.protocol)) referrer = url.origin;
    } catch {
      /* Direct or unavailable. */
    }
    let timezone = '';
    try {
      if (client.timezone)
        timezone = new Intl.DateTimeFormat('en', { timeZone: client.timezone }).resolvedOptions()
          .timeZone;
    } catch {
      /* Invalid client hint. */
    }
    await database.db
      .prepare(
        `INSERT INTO traffic_context VALUES(?,?,?,?) ON CONFLICT(visit_id) DO UPDATE
        SET country=excluded.country,ip_hash=excluded.ip_hash,details=excluded.details
        WHERE traffic_context.country='' AND excluded.country<>''`,
      )
      .run(
        mac(key, sessionHash + ':' + path),
        geo.country,
        trafficIp(request) ? mac(key, 'ip:' + trafficIp(request)) : '',
        encryptIp(
          key,
          JSON.stringify({
            ...geo,
            referrer,
            timezone,
            width: client.width,
            height: client.height,
            screenWidth: client.screenWidth,
            screenHeight: client.screenHeight,
            pixelRatio: client.pixelRatio,
            language: (request.headers.get('accept-language') || '').slice(0, 120),
          }),
          'profile-traffic-context:v1',
        ),
      );
  }
  return {
    summary: await trafficSummary(database),
    cookie: valid
      ? undefined
      : `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800${production ? '; Secure' : ''}`,
  };
}
export async function trafficDetails(
  database: Database,
  page: number,
  query: string,
  input: TrafficFilters = {},
) {
  const filters = trafficFilterSchema.parse(input);
  const key = credentialKey(database.directory, true);
  const since = filters.from ? Date.parse(filters.from + 'T00:00:00+07:00') : 0;
  const until = filters.to ? Date.parse(filters.to + 'T00:00:00+07:00') + day : Date.now() + 1;
  const pattern = '%' + query.toLowerCase().replace(/[\\%_]/g, '') + '%';
  const conditions = [
    `v.created_at>=?`,
    `v.created_at<?`,
    `(LOWER(v.path) LIKE ? OR LOWER(v.browser) LIKE ? OR LOWER(v.device) LIKE ? OR LOWER(v.os) LIKE ? OR LOWER(COALESCE(c.country,'')) LIKE ?)`,
  ];
  const values: (number | string)[] = [since, until, pattern, pattern, pattern, pattern, pattern];
  for (const column of ['browser', 'device', 'os', 'path'] as const)
    if (filters[column]) {
      conditions.push('COALESCE(NULLIF(v.' + column + ",''),'Unknown')=?");
      values.push(filters[column]);
    }
  if (filters.country) {
    conditions.push("COALESCE(NULLIF(c.country,''),'unknown')=?");
    values.push(filters.country);
  }
  if (filters.ip) {
    conditions.push('c.ip_hash=?');
    values.push(mac(key, 'ip:' + filters.ip));
  }
  const filter = conditions.join(' AND ');
  const source = 'traffic_visits v LEFT JOIN traffic_context c ON c.visit_id=v.id';
  const count = (await database.db
    .prepare(
      "SELECT COUNT(*) AS total,COUNT(DISTINCT v.session_hash) AS visits,COALESCE(SUM(CASE WHEN v.path IN ('/','/profile') THEN 1 ELSE 0 END),0) AS profiles FROM " +
        source +
        ' WHERE ' +
        filter,
    )
    .get(...values)) as {
    total: number | string;
    visits: number | string;
    profiles: number | string;
  };
  const rows = (await database.db
    .prepare(
      "SELECT v.*,COALESCE(c.country,'') AS country,COALESCE(c.details,'') AS details FROM " +
        source +
        ' WHERE ' +
        filter +
        ' ORDER BY v.created_at DESC,v.id LIMIT 50 OFFSET ?',
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
    country: string;
    details: string;
    session_hash: string;
  }>;
  const daily = (await database.db
    .prepare(
      'SELECT CAST((v.created_at+' +
        analyticsOffset +
        ') / ' +
        day +
        ' AS BIGINT) AS bucket,COUNT(*) AS views,COUNT(DISTINCT v.session_hash) AS visits FROM ' +
        source +
        ' WHERE ' +
        filter +
        ' GROUP BY bucket ORDER BY bucket',
    )
    .all(...values)) as Array<{
    bucket: number | string;
    views: number | string;
    visits: number | string;
  }>;
  const countries = (await database.db
    .prepare(
      "SELECT COALESCE(NULLIF(c.country,''),'unknown') AS country,COUNT(*) AS views,COUNT(DISTINCT v.session_hash) AS visits FROM " +
        source +
        ' WHERE ' +
        filter +
        " GROUP BY COALESCE(NULLIF(c.country,''),'unknown') ORDER BY views DESC",
    )
    .all(...values)) as Array<{ country: string; views: number | string; visits: number | string }>;
  const options: Record<string, string[]> = {};
  const breakdowns: Record<string, Array<{ name: string; views: number }>> = {};
  for (const column of ['browser', 'device', 'os', 'path'] as const) {
    const grouped = (await database.db
      .prepare(
        'SELECT COALESCE(NULLIF(v.' +
          column +
          ",''),'Unknown') AS name,COUNT(*) AS views FROM " +
          source +
          ' WHERE ' +
          filter +
          ' GROUP BY COALESCE(NULLIF(v.' +
          column +
          ",''),'Unknown') ORDER BY views DESC,name LIMIT 12",
      )
      .all(...values)) as Array<{ name: string; views: number | string }>;
    breakdowns[column] = grouped.map((row) => ({ name: row.name, views: Number(row.views) }));
  }
  for (const column of ['browser', 'device', 'os', 'path'] as const)
    options[column] = (
      (await database.db
        .prepare(
          'SELECT DISTINCT ' +
            column +
            ' AS value FROM traffic_visits WHERE ' +
            column +
            "<>'' ORDER BY value",
        )
        .all()) as { value: string }[]
    ).map((row) => row.value);
  options.country = (
    (await database.db
      .prepare('SELECT DISTINCT country AS value FROM traffic_context ORDER BY country')
      .all()) as { value: string }[]
  ).map((row) => row.value || 'unknown');
  return {
    ...(await trafficSummary(database)),
    total: Number(count.total),
    filtered: {
      pageViews: Number(count.total),
      visits: Number(count.visits),
      profileViews: Number(count.profiles),
      countries: countries.filter((row) => row.country !== 'unknown').length,
    },
    breakdowns,
    page,
    pageSize: 50,
    filters,
    options,
    timezone: 'Asia/Ho_Chi_Minh',
    daily: daily.map((row) => ({
      date: new Date(Number(row.bucket) * day).toISOString().slice(0, 10),
      views: Number(row.views),
      visits: Number(row.visits),
    })),
    countries: countries.map((row) => ({
      ...row,
      views: Number(row.views),
      visits: Number(row.visits),
    })),
    entries: rows.map((row) => {
      let context = trafficClientSchema.parse({}) as z.infer<typeof trafficClientSchema> & {
        city?: string;
        region?: string;
        language?: string;
        continent?: string;
        latitude?: string;
        longitude?: string;
        geoTimezone?: string;
        postalCode?: string;
      };
      try {
        context = JSON.parse(decryptIp(key, row.details, 'profile-traffic-context:v1'));
      } catch {
        /* Older records have no context. */
      }
      return {
        id: row.id,
        path: row.path,
        at: Number(row.created_at),
        ip: decryptIp(key, row.ip),
        userAgent: row.user_agent,
        browser: row.browser,
        device: row.device,
        os: row.os,
        country: row.country,
        sessionId: row.session_hash.slice(0, 12),
        ...context,
      };
    }),
  };
}
