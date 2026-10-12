'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from './language';
import { documentKind, isImageFile, LOCAL_FILE } from '../lib/file-types';
import { DocumentPreview } from './document-preview';
import { Icon } from './icon';

export function FileDocument({
  url,
  name = 'Document',
  cv = false,
  trigger,
  triggerClassName = 'btn neutral',
  showDownload = true,
  image: imageRequested = false,
}: {
  url: string;
  name?: string;
  cv?: boolean;
  trigger?: ReactNode;
  triggerClassName?: string;
  showDownload?: boolean;
  image?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
  const dialog = useRef<HTMLDialogElement>(null);
  const kind = documentKind(url) || documentKind(name);
  const image = imageRequested || isImageFile(url) || (!documentKind(url) && isImageFile(name));
  const path = url.split(/[?#]/)[0];
  const local = LOCAL_FILE.test(path);
  const previewable = local || url.startsWith('blob:');
  const uploaded = local || (image && /^\/uploads\/[a-f0-9-]+\.[a-z]+$/i.test(path));
  const download = uploaded
    ? url.split('#')[0] + (url.includes('?') ? '&' : '?') + 'download=1'
    : url;
  const pdf = !image && previewable && kind === 'pdf';
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
    // Keep dialog autofocus off the download link after a touch opens the viewer.
    element?.focus({ preventScroll: true });
    return () => {
      element?.close();
      previous?.focus();
    };
  }, [open]);
  return (
    <span className="file-document">
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setImageState('loading');
          setOpen(true);
        }}
        title={name}
        aria-label={image ? t('Xem ảnh', 'Preview image') + ': ' + name : undefined}
      >
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
          className={
            'cv-viewer' + (pdf ? ' cv-viewer-pdf' : '') + (image ? ' cv-viewer-image' : '')
          }
          aria-label={name}
          tabIndex={-1}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (image && event.target === event.currentTarget) dialog.current?.close();
          }}
        >
          {!pdf && (
            <div className="cv-viewer-head">
              <div>
                <strong title={name}>{name}</strong>
                {!pdf && (
                  <small>
                    {image
                      ? t('Ảnh', 'Image')
                      : (documentKind(url) || documentKind(name) || 'file').toUpperCase()}
                  </small>
                )}
              </div>
              {!pdf && <div className="cv-actions">{viewerActions}</div>}
            </div>
          )}
          {image ? (
            <div className="image-preview-stage" aria-busy={imageState === 'loading'}>
              <img
                src={url}
                alt={name}
                onLoad={() => setImageState('ready')}
                onError={() => setImageState('error')}
              />
              {imageState === 'loading' && (
                <span className="image-preview-status" role="status">
                  {t('Đang tải ảnh…', 'Loading image…')}
                </span>
              )}
              {imageState === 'error' && (
                <span className="image-preview-status" role="alert">
                  {t(
                    'Không tải được ảnh. Hãy đóng và mở lại để thử lại.',
                    'Could not load this image. Close and reopen to retry.',
                  )}
                </span>
              )}
            </div>
          ) : previewable ? (
            <DocumentPreview
              url={url}
              name={documentKind(url) ? url : name}
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
