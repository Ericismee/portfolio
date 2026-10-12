'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { documentKind } from '../lib/file-types';
import { MAX_UPLOAD_BYTES } from '../lib/upload-limits';
import { useLanguage } from './language';
import { PdfPreview } from './pdf-preview';
import { MarkdownContent } from './markdown-content';

export function DocumentPreview({
  url,
  name,
  pdfActions,
  pdfTitle,
}: {
  url: string;
  name: string;
  pdfActions?: ReactNode;
  pdfTitle?: string;
}) {
  const kind = documentKind(name) || documentKind(url);
  const { t } = useLanguage();
  const [state, setState] = useState({ text: '', error: '', ready: false, truncated: false });
  useEffect(() => {
    if (kind === 'pdf' || !kind) return;
    const controller = new AbortController();
    let disposed = false;
    async function load() {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
        });
        if (!response.ok || !response.body)
          throw Error('Preview unavailable / Không xem trước được');
        const limit =
          kind === 'txt' || kind === 'md'
            ? 200000
            : kind === 'svg'
              ? 1024 * 1024
              : MAX_UPLOAD_BYTES;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0,
          truncated = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (total + value.length > limit) {
            chunks.push(value.slice(0, limit - total));
            total = limit;
            truncated = true;
            await reader.cancel();
            break;
          }
          chunks.push(value);
          total += value.length;
        }
        if (truncated && kind !== 'txt' && kind !== 'md')
          throw Error('File too large / File quá lớn');
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        let text = '';
        if (kind === 'docx' || kind === 'svg') {
          const parser = await import('../lib/document-files');
          if (kind === 'docx') {
            text = parser.docxText(bytes);
            truncated = text.length >= 100000;
          } else parser.validateSvg(bytes);
        } else text = new TextDecoder().decode(bytes);
        if (!disposed) setState({ text, error: '', ready: true, truncated });
      } catch (error) {
        if (!disposed)
          setState({
            text: '',
            error: error instanceof Error ? error.message : 'Preview unavailable',
            ready: false,
            truncated: false,
          });
      }
    }
    void load();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [url, kind]);
  if (kind === 'pdf') return <PdfPreview url={url} actions={pdfActions} title={pdfTitle || name} />;
  if (!kind)
    return (
      <div className="document-preview">
        <img src={url} alt={name} />
      </div>
    );
  return (
    <div className="document-preview" aria-busy={!state.ready && !state.error}>
      {state.error ? (
        <p role="alert">{state.error}</p>
      ) : !state.ready ? (
        <p role="status">{t('Đang tạo bản xem trước…', 'Preparing preview…')}</p>
      ) : (
        <>
          {kind === 'svg' ? (
            <img src={url} alt={name} />
          ) : kind === 'md' ? (
            <MarkdownContent value={state.text} />
          ) : (
            <pre className="document-text">
              {state.text || t('Tài liệu không có văn bản.', 'This document contains no text.')}
            </pre>
          )}
          {kind === 'docx' && (
            <p className="admin-help">
              {t(
                'Bản xem trước văn bản. Tải xuống để xem bố cục, hình ảnh và định dạng gốc.',
                'Text preview. Download to see the original layout, images and formatting.',
              )}
            </p>
          )}
          {state.truncated && (
            <p className="admin-help">
              {t(
                'Bản xem trước đã rút gọn. Tải xuống để đọc toàn bộ.',
                'Preview shortened. Download to read the complete file.',
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
