export async function uploadMime(file: File): Promise<string> {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (file.size > (pdf ? 2 : 3) * 1024 * 1024)
    throw Error(pdf ? 'PDF tối đa 2 MB / PDF up to 2 MB' : 'Ảnh tối đa 3 MB / Images up to 3 MB');
  if (pdf) {
    const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (signature !== '%PDF-') throw Error('File PDF không hợp lệ / Invalid PDF file');
    return 'application/pdf';
  }
  return file.type;
}
