import { MAX_UPLOAD_BYTES } from './upload-limits.ts';
export async function uploadMime(file: File): Promise<string> {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (file.size > MAX_UPLOAD_BYTES)
    throw Error(
      pdf ? 'PDF tối đa 20 MB / PDF up to 20 MB' : 'Ảnh tối đa 20 MB / Images up to 20 MB',
    );
  if (pdf) {
    const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (signature !== '%PDF-') throw Error('File PDF không hợp lệ / Invalid PDF file');
    return 'application/pdf';
  }
  return file.type;
}
