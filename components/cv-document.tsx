'use client';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from './language';
import { PdfPreview } from './pdf-preview';

export function CvDocument({ url, name = 'CV.pdf' }: { url: string; name?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const local = /^\/uploads\/[a-f0-9-]+\.pdf$/.test(url);
  const download = local ? url + '?download=1' : url;
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  return (
    <>
      <div className="cv-actions">
        <button type="button" className="btn neutral" onClick={() => setOpen(true)}>
          {t('Xem CV', 'View CV')}
        </button>
        <a
          className="btn neutral"
          href={download}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Tải CV', 'Download CV')}
        </a>
      </div>
      {open && (
        <dialog
          ref={dialog}
          className="cv-viewer"
          aria-label={t('Xem CV PDF', 'View PDF CV')}
          onClose={() => setOpen(false)}
        >
          <div className="cv-viewer-head">
            <div>
              <strong>{name}</strong>
              <small>PDF</small>
            </div>
            <div className="cv-actions">
              <a className="btn neutral" href={url} target="_blank" rel="noopener noreferrer">
                {t('Mở tab mới', 'Open in new tab')}
              </a>
              <a className="btn primary" href={download} download={name}>
                {t('Tải xuống', 'Download')}
              </a>
              <button
                type="button"
                className="btn neutral"
                onClick={() => dialog.current?.close()}
                aria-label={t('Đóng CV', 'Close CV')}
              >
                ×
              </button>
            </div>
          </div>
          {local ? (
            <PdfPreview url={url} />
          ) : (
            <p>
              {t(
                'Mở tab mới để xem CV từ liên kết bên ngoài.',
                'Open a new tab to view this externally hosted CV.',
              )}
            </p>
          )}
          <p className="cv-viewer-help">
            {t(
              'Nếu trình duyệt không hiển thị PDF, chọn Mở tab mới hoặc Tải xuống.',
              'If your browser cannot display PDF, open it in a new tab or download it.',
            )}
          </p>
        </dialog>
      )}
    </>
  );
}
