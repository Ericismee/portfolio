'use client';
import { useEffect, useRef, useState } from 'react';
import { FILE_ACCEPT } from '../lib/file-types';
import { uploadMime } from '../lib/upload-client';
import { FileDocument } from './file-document';
import { useLanguage } from './language';
export type AttachmentUpload = (file: File, done: (url: string) => void) => Promise<boolean>;
export function AttachmentPicker({
  upload,
  insert,
}: {
  upload: AttachmentUpload;
  insert: (url: string, name: string, image: boolean) => void;
}) {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div className="attachment-picker">
      <button
        type="button"
        className="btn neutral"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {t('Đính kèm file', 'Attach file')}
      </button>
      <input
        ref={input}
        hidden
        type="file"
        accept={FILE_ACCEPT}
        onChange={async (e) => {
          const selected = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (!selected) return;
          try {
            await uploadMime(selected);
            setError('');
            setFile(selected);
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Invalid file');
          }
        }}
      />
      {file && (
        <div className="attachment-selection">
          <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
          {url && <FileDocument url={url} name={file.name} />}
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const mime = await uploadMime(file);
                if (await upload(file, (src) => insert(src, file.name, mime.startsWith('image/'))))
                  setFile(null);
              } catch (error) {
                setError(error instanceof Error ? error.message : 'Upload failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t('Đang tải…', 'Uploading…') : t('Tải lên và chèn', 'Upload and insert')}
          </button>
          <button
            type="button"
            className="btn neutral"
            disabled={busy}
            onClick={() => setFile(null)}
          >
            {t('Hủy', 'Cancel')}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <small className="admin-help">
        PDF, DOCX, TXT, Markdown, SVG, PNG, JPG, WebP, GIF · 20 MB (
        {t('SVG tối đa 1 MB', 'SVG up to 1 MB')})
      </small>
    </div>
  );
}
