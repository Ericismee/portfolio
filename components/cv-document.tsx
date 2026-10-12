import { FileDocument } from './file-document';
export function CvDocument({
  url,
  name = 'CV.pdf',
  showDownload = true,
}: {
  url: string;
  name?: string;
  showDownload?: boolean;
}) {
  return <FileDocument url={url} name={name} cv showDownload={showDownload} />;
}
