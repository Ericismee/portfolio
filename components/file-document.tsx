'use client';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from './language';
import { documentKind, LOCAL_FILE } from '../lib/file-types';
import { DocumentPreview } from './document-preview';

export function FileDocument({
  url,
  name = 'Document',
  cv = false,
}: {
  url: string;
  name?: string;
  cv?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const local = LOCAL_FILE.test(url),
    previewable = local || url.startsWith('blob:');
  const download = local ? url + '?download=1' : url;
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, [open]);
  return (
    <span className="file-document">
      <button type="button" className="btn neutral" onClick={() => setOpen(true)} title={name}>
        {cv ? (
          t('Xem CV', 'View CV')
        ) : (
          <>
            {name} · {t('Xem trước', 'Preview')}
          </>
        )}
      </button>
      <a
        className="btn neutral"
        href={download}
        download={name}
        target="_blank"
        rel="noopener noreferrer"
      >
        {cv ? t('Tải CV', 'Download CV') : t('Tải xuống', 'Download')}
      </a>
      {open && (
        <dialog ref={dialog} className="cv-viewer" aria-label={name} onClose={() => setOpen(false)}>
          <div className="cv-viewer-head">
            <div>
              <strong>{name}</strong>
              <small>{(documentKind(url) || documentKind(name) || 'file').toUpperCase()}</small>
            </div>
            <div className="cv-actions">
              <a
                className="btn neutral"
                href={download}
                download={name}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('Tải xuống', 'Download')}
              </a>
              <button
                type="button"
                className="btn neutral"
                onClick={() => dialog.current?.close()}
                aria-label={t('Đóng bản xem trước', 'Close preview')}
              >
                ×
              </button>
            </div>
          </div>
          {previewable ? (
            <DocumentPreview url={url} name={local ? url : name} />
          ) : (
            <p className="document-preview">
              {t(
                'Mở liên kết bên ngoài để xem tài liệu.',
                'Open the external link to view this document.',
              )}{' '}
              <a href={url} target="_blank" rel="noopener noreferrer">
                {t('Mở tài liệu', 'Open document')}
              </a>
            </p>
          )}
        </dialog>
      )}
    </span>
  );
}
