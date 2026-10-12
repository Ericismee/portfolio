'use client';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useLanguage } from './language';
import { Icon } from './icon';

export function PdfPreview({ url }: { url: string }) {
  const { t } = useLanguage();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!pages.current) return;
    const element = pages.current;
    const measure = () => setWidth(Math.max(200, element.clientWidth - 40));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    let task: { destroy: () => Promise<void> } | undefined;
    void import('pdfjs-dist')
      .then(async (pdfjs) => {
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const loadingTask = pdfjs.getDocument({ url });
        task = loadingTask;
        const pdf = await loadingTask.promise;
        if (!disposed) setDocument(pdf);
      })
      .catch(() => {
        if (!disposed) {
          setError('read');
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      void task?.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let disposed = false;
    let render: { cancel: () => void } | undefined;
    const element = canvas.current;
    void document
      .getPage(page)
      .then(async (pdfPage) => {
        if (disposed) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({
          scale: Math.min(1.4, width / natural.width) * zoom,
        });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        element.width = Math.floor(viewport.width * ratio);
        element.height = Math.floor(viewport.height * ratio);
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        const rendering = pdfPage.render({
          canvas: element,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        render = rendering;
        await rendering.promise;
        if (!disposed) setLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setError('render');
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [document, page, zoom, width]);
  return (
    <div className="pdf-preview">
      <div className="pdf-toolbar">
        <button
          type="button"
          className="btn neutral"
          aria-label={t('Trang trước', 'Previous page')}
          title={t('Trang trước', 'Previous page')}
          disabled={!document || page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <Icon name="previous" />
        </button>
        <span className="pdf-page-count" aria-live="polite" aria-label={t(`Trang ${page} trên ${document?.numPages || '…'}`, `Page ${page} of ${document?.numPages || '…'}`)}>
          {page} / {document?.numPages || '…'}
        </span>
        <button
          type="button"
          className="btn neutral"
          aria-label={t('Trang sau', 'Next page')}
          title={t('Trang sau', 'Next page')}
          disabled={!document || page >= document.numPages}
          onClick={() => setPage((p) => p + 1)}
        >
          <Icon name="next" />
        </button>
        <label className="pdf-zoom" title={t('Thu phóng PDF', 'PDF zoom')}>
        <Icon name="zoom" />
        <select
          aria-label={t('Thu phóng PDF', 'PDF zoom')}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        >
          <option value={0.7}>70%</option>
          <option value={1}>100%</option>
          <option value={1.25}>125%</option>
          <option value={1.5}>150%</option>
        </select>
        </label>
      </div>
      <div className="pdf-pages" ref={pages} aria-busy={loading}>
        {loading && !error && <p role="status">{t('Đang đọc PDF…', 'Loading PDF…')}</p>}
        {error && (
          <p role="alert">
            {error === 'read'
              ? t('Không thể đọc PDF', 'Cannot read PDF')
              : t('Không thể hiển thị trang PDF', 'Cannot render PDF page')}
          </p>
        )}
        <canvas
          ref={canvas}
          role="img"
          aria-label={t(`Nội dung CV PDF, trang ${page}`, `PDF CV document, page ${page}`)}
        />
      </div>
    </div>
  );
}
