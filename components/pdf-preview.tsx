'use client';
import { useEffect, useRef, useState, type RefObject, type ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useLanguage } from './language';
import { PdfIcon } from './pdf-icon';
import { Icon } from './icon';

type PageSize = { width: number; height: number };

function PdfPage({
  document,
  number,
  width,
  zoom,
  root,
  initialSize,
}: {
  document: PDFDocumentProxy;
  number: number;
  width: number;
  zoom: number;
  root: RefObject<HTMLDivElement | null>;
  initialSize: PageSize;
}) {
  const { t } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [nearby, setNearby] = useState(false);
  const [size, setSize] = useState(initialSize);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!container.current || !root.current) return;
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), {
      root: root.current,
      rootMargin: '600px 0px',
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [root]);
  useEffect(() => {
    if (!nearby || !canvas.current) return;
    let disposed = false;
    let render: { cancel: () => void } | undefined;
    const element = canvas.current;
    setLoading(true);
    setError(false);
    void document
      .getPage(number)
      .then(async (pdfPage) => {
        if (disposed) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        setSize({ width: natural.width, height: natural.height });
        const viewport = pdfPage.getViewport({
          scale: Math.min(1.4, width / natural.width) * zoom,
        });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        element.width = Math.floor(viewport.width * ratio);
        element.height = Math.floor(viewport.height * ratio);
        element.style.width = `${viewport.width}px`;
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
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [document, number, nearby, width, zoom]);
  return (
    <div
      ref={container}
      className="pdf-page"
      data-pdf-page={number}
      style={{
        width: Math.min(1.4, width / size.width) * zoom * size.width,
        aspectRatio: `${size.width} / ${size.height}`,
      }}
      aria-busy={nearby && loading}
    >
      {nearby && (
        <canvas
          ref={canvas}
          role="img"
          aria-label={t(`Trang PDF ${number}`, `PDF page ${number}`)}
        />
      )}
      {nearby && loading && !error && (
        <span className="pdf-page-status" role="status">
          {t('Đang đọc PDF…', 'Loading PDF…')}
        </span>
      )}
      {error && (
        <span className="pdf-page-status" role="alert">
          {t('Không thể hiển thị trang PDF', 'Cannot render PDF page')}
        </span>
      )}
    </div>
  );
}

export function PdfPreview({
  url,
  actions,
  title,
}: {
  url: string;
  actions?: ReactNode;
  title?: string;
}) {
  const { t } = useLanguage();
  const pages = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [initialSize, setInitialSize] = useState<PageSize>({ width: 595, height: 842 });
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!pages.current) return;
    const element = pages.current;
    const measure = () => setWidth(Math.max(200, element.clientWidth));
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
        const first = await pdf.getPage(1);
        const natural = first.getViewport({ scale: 1 });
        if (!disposed) {
          setInitialSize({ width: natural.width, height: natural.height });
          setDocument(pdf);
          setLoading(false);
        }
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
  const scrollFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);
  const updatePage = () => {
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const root = pages.current;
      if (!root) return;
      const marker = root.getBoundingClientRect().top + root.clientHeight / 2;
      let nearest = 1;
      for (const element of root.querySelectorAll<HTMLElement>('[data-pdf-page]')) {
        if (element.getBoundingClientRect().top > marker) break;
        nearest = Number(element.dataset.pdfPage);
      }
      setPage(nearest);
    });
  };
  const goToPage = (number: number) => {
    const root = pages.current;
    const target = root?.querySelector<HTMLElement>(`[data-pdf-page="${number}"]`);
    if (!root || !target) return;
    root.scrollTo({
      top: root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top,
    });
    setPage(number);
  };
  return (
    <div className="pdf-preview">
      <div className="pdf-toolbar" role="group" aria-label={t('Điều khiển PDF', 'PDF controls')}>
        <strong className="pdf-title" title={title}>
          {title || 'PDF'}
        </strong>
        {actions && <span className="pdf-file-actions">{actions}</span>}
        <details className="pdf-options">
          <summary
            aria-label={t('Tùy chọn xem PDF', 'PDF viewing options')}
            title={t('Chuyển trang và thu phóng', 'Pages and zoom')}
          >
            <Icon name="filters" />
          </summary>
          <div
            className="pdf-options-panel"
            role="group"
            aria-label={t('Chuyển trang và thu phóng', 'Pages and zoom')}
          >
            <button
              type="button"
              className="btn neutral pdf-nav"
              aria-label={t('Trang trước', 'Previous page')}
              title={t('Trang trước', 'Previous page')}
              disabled={!document || page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <PdfIcon name="previous" />
            </button>
            <span
              className="pdf-page-count"
              aria-live="polite"
              aria-label={t(
                `Trang ${page} trên ${document?.numPages || '…'}`,
                `Page ${page} of ${document?.numPages || '…'}`,
              )}
            >
              {page} / {document?.numPages || '…'}
            </span>
            <button
              type="button"
              className="btn neutral pdf-nav"
              aria-label={t('Trang sau', 'Next page')}
              title={t('Trang sau', 'Next page')}
              disabled={!document || page >= document.numPages}
              onClick={() => goToPage(page + 1)}
            >
              <PdfIcon name="next" />
            </button>
            <label
              className="pdf-zoom"
              title={t('Thu phóng PDF', 'PDF zoom') + ` · ${zoom * 100}%`}
            >
              <PdfIcon name="zoom" />
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
        </details>
      </div>
      <div
        className="pdf-pages"
        ref={pages}
        aria-busy={loading}
        onScroll={updatePage}
        tabIndex={0}
        role="region"
        aria-label={t('Các trang PDF · Cuộn để đọc', 'PDF pages · Scroll to read')}
      >
        {loading && !error && <p role="status">{t('Đang đọc PDF…', 'Loading PDF…')}</p>}
        {error && (
          <p role="alert">
            {error === 'read'
              ? t('Không thể đọc PDF', 'Cannot read PDF')
              : t('Không thể hiển thị trang PDF', 'Cannot render PDF page')}
          </p>
        )}
        {document &&
          Array.from({ length: document.numPages }, (_, index) => (
            <PdfPage
              key={index + 1}
              document={document}
              number={index + 1}
              width={width}
              zoom={zoom}
              root={pages}
              initialSize={initialSize}
            />
          ))}
      </div>
    </div>
  );
}
