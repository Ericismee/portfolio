import { FileDocument } from './file-document';
export function CvDocument({ url, name = 'CV.pdf' }: { url: string; name?: string }) {
  return <FileDocument url={url} name={name} cv />;
}
