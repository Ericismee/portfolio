export const documentTypes = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
  svg: 'image/svg+xml',
} as const;
export const FILE_ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.svg,.png,.jpg,.jpeg,.webp,.gif';
export const DOCUMENT_ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.svg';
export const LOCAL_FILE = /^\/uploads\/[a-f0-9-]+\.(pdf|docx|txt|md|svg)$/;
export function documentKind(name: string) {
  const ext = name.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  return ext === 'markdown'
    ? 'md'
    : ext && ext in documentTypes
      ? (ext as keyof typeof documentTypes)
      : undefined;
}

export function isImageFile(name: string) {
  return /\.(png|jpe?g|webp|gif|avif|bmp|ico|svg)$/i.test(name.split(/[?#]/)[0]);
}
