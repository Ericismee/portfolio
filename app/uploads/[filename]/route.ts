import { getDatabase } from '../../../lib/database';
import { authService } from '../../../lib/auth';
import { publicContent } from '../../../lib/schema';
import { readUpload, mimeTypes } from '../../../lib/uploads';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]+\.(png|jpg|webp|gif|pdf)$/.test(filename))
    return new Response('Not found', { status: 404 });
  const database = getDatabase(),
    content = publicContent(database.read().data),
    url = '/uploads/' + filename;
  const referenced = (v: unknown): boolean =>
    typeof v === 'string'
      ? v === url
      : !!v && typeof v === 'object' && Object.values(v).some(referenced);
  if (!authService(database).session(request) && !referenced(content))
    return new Response('Not found', { status: 404 });
  try {
    const body = await readUpload(database.directory, filename),
      mime = mimeTypes[filename.split('.').pop()!];
    return new Response(new Uint8Array(body), {
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
