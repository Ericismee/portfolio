import { getDatabase } from '../../../lib/database';
import { uploadResponse } from '../../../lib/upload-response';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  return uploadResponse(await getDatabase(), request, (await params).filename);
}
