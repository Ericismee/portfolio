import type { Database } from './database.ts';
import { authService } from './auth.ts';
import { publicContent } from './schema.ts';
import { uploadBody, mimeTypes } from './uploads.ts';

export async function uploadResponse(database: Database, request: Request, filename: string) {
  if (!/^[a-f0-9-]+\.(png|jpg|webp|gif|pdf|docx|txt|md|svg)$/.test(filename))
    return new Response('Not found', { status: 404 });
  const content = publicContent((await database.read()).data),
    url = '/uploads/' + filename;
  const referenced = (v: unknown): boolean =>
    typeof v === 'string'
      ? v === url ||
        (v
          .match(
            /\/uploads\/[a-f0-9-]+\.(?:png|jpg|webp|gif|pdf|docx|txt|md|svg)(?![a-zA-Z0-9_.-])/g,
          )
          ?.some((reference) => reference === url) ??
          false)
      : !!v && typeof v === 'object' && Object.values(v).some(referenced);
  if (!(await authService(database).session(request)) && !referenced(content))
    return new Response('Not found', { status: 404 });
  try {
    const body = await uploadBody(database.directory, filename),
      mime = mimeTypes[filename.split('.').pop()!];
    return new Response(body as BodyInit, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        ...(['pdf', 'docx', 'txt', 'md', 'svg'].includes(filename.split('.').pop()!)
          ? {
              'Content-Disposition': `${new URL(request.url).searchParams.get('download') === '1' || mime.includes('wordprocessingml') ? 'attachment' : 'inline'}; filename="document.${filename.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(content.cv?.url === url ? content.cv.name : 'document.' + filename.split('.').pop())}`,
            }
          : {}),
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
