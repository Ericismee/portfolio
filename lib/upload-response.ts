import type { Database } from './database.ts';
import { authService } from './auth.ts';
import { publicContent } from './schema.ts';
import { uploadBody, mimeTypes } from './uploads.ts';

export async function uploadResponse(database: Database, request: Request, filename: string) {
  if (!/^[a-f0-9-]+\.(png|jpg|webp|gif|pdf)$/.test(filename))
    return new Response('Not found', { status: 404 });
  const content = publicContent((await database.read()).data),
    url = '/uploads/' + filename;
  const referenced = (v: unknown): boolean =>
    typeof v === 'string'
      ? v === url ||
        (v
          .match(/\/uploads\/[a-f0-9-]+\.(?:png|jpg|webp|gif|pdf)(?![a-zA-Z0-9_.-])/g)
          ?.some((reference) => reference === url) ??
          false)
      : !!v && typeof v === 'object' && Object.values(v).some(referenced);
  if (!await authService(database).session(request) && !referenced(content))
    return new Response('Not found', { status: 404 });
  try {
    const body = await uploadBody(database.directory, filename),
      mime = mimeTypes[filename.split('.').pop()!];
    return new Response(body as BodyInit, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, no-store',
        ...(mime === 'application/pdf'
          ? {
              'Content-Disposition': `${new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="CV.pdf"; filename*=UTF-8''${encodeURIComponent(content.cv?.url === url ? content.cv.name : 'CV.pdf')}`,
            }
          : {}),
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
