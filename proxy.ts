import { NextResponse, type NextRequest } from 'next/server';
import { getDatabase } from './lib/database';
import { publicContent } from './lib/schema';
const routes = new Set([
  '',
  'admin',
  'profile',
  'projects',
  'activity',
  'feed',
  'posts',
  'contact',
  'github',
  'search',
]);
function missing() {
  return new NextResponse(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Eric | Page not found</title><body style="font-family:system-ui;background:#101827;color:#eef2ff;padding:10vh 8vw"><main><h1>404 — Page not found</h1><p>This page is unavailable or no longer public.</p><a href="/" style="color:#9db4ff">Return home</a></main></body></html>',
    {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  );
}
export async function proxy(request: NextRequest) {
  let parts: string[];
  try {
    parts = decodeURIComponent(request.nextUrl.pathname).split('/').filter(Boolean);
  } catch {
    return missing();
  }
  if (
    parts.length > 2 ||
    !routes.has(parts[0] || '') ||
    (parts.length === 2 && !['projects', 'posts'].includes(parts[0]))
  )
    return missing();
  if (parts.length === 2) {
    const data = publicContent((await (await getDatabase()).read()).data);
    const entries = parts[0] === 'projects' ? data.projects : data.posts;
    if (!entries.some((entry) => entry.id === parts[1])) return missing();
  }
  return NextResponse.next();
}
export const config = {
  matcher: [
    '/((?!api/|_next/|uploads/|tech/|brand-terminal\\.svg|icon\\.svg|favicon\\.ico|apple-icon\\.png|opengraph-image|robots\\.txt|sitemap\\.xml).*)',
  ],
};
