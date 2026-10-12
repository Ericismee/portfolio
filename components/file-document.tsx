'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from './language';
import { documentKind, LOCAL_FILE } from '../lib/file-types';
import { DocumentPreview } from './document-preview';
import { Icon } from './icon';

export function FileDocument({
  url,
  name = 'Document',
  cv = false,
  trigger,
  triggerClassName = 'btn neutral',
  showDownload = true,
}: {
  url: string;
  name?: string;
  cv?: boolean;
  trigger?: ReactNode;
  triggerClassName?: string;
  showDownload?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const local = LOCAL_FILE.test(url),
    previewable = local || url.startsWith('blob:');
  const download = local ? url + '?download=1' : url;
  const pdf = previewable && (documentKind(local ? url : name) || documentKind(url)) === 'pdf';
  const viewerActions = (
    <>
      <a
        className="btn neutral icon-action"
        href={download}
        download={name}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('Tải xuống', 'Download')}
        title={t('Tải xuống', 'Download')}
      >
        <Icon name="download" />
      </a>
      <button
        type="button"
        className="btn neutral icon-action"
        onClick={() => dialog.current?.close()}
        aria-label={t('Đóng bản xem trước', 'Close preview')}
        title={t('Đóng bản xem trước', 'Close preview')}
      >
        <Icon name={pdf ? 'previous' : 'close'} />
      </button>
    </>
  );
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
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)} title={name}>
        {trigger ||
          (cv ? (
            t('Xem CV', 'View CV')
          ) : (
            <>
              {name} · {t('Xem trước', 'Preview')}
            </>
          ))}
      </button>
      {showDownload && (
        <a
          className="btn neutral"
          href={download}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cv ? t('Tải CV', 'Download CV') : t('Tải xuống', 'Download')}
        </a>
      )}
      {open && (
        <dialog
          ref={dialog}
          className={'cv-viewer' + (pdf ? ' cv-viewer-pdf' : '')}
          aria-label={name}
          onClose={() => setOpen(false)}
        >
          {!pdf && (
            <div className="cv-viewer-head">
              <div>
                <strong title={name}>{name}</strong>
                {!pdf && (
                  <small>{(documentKind(url) || documentKind(name) || 'file').toUpperCase()}</small>
                )}
              </div>
              {!pdf && <div className="cv-actions">{viewerActions}</div>}
            </div>
          )}
          {previewable ? (
            <DocumentPreview
              url={url}
              name={local ? url : name}
              pdfActions={viewerActions}
              pdfTitle={name}
            />
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
