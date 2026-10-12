import { timingSafeEqual } from 'node:crypto';
import { cloudBackup } from '../../../../lib/cloud-backup';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  const expected = Buffer.from('Bearer ' + (process.env.CRON_SECRET || ''));
  const received = Buffer.from(request.headers.get('authorization') || '');
  if (
    !process.env.CRON_SECRET ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    return new Response('Unauthorized', { status: 401 });
  try {
    return Response.json(await cloudBackup(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Provider exceptions can contain connection strings; never echo them.
    console.error('Scheduled backup failed. Check storage, database and backup configuration.');
    return Response.json({ error: 'Backup failed' }, { status: 503 });
  }
}
