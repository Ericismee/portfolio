'use client';
import { useId, useRef, useState } from 'react';
import { MarkdownContent } from './markdown-content';
import { useLanguage } from './language';
import { MAX_UPLOAD_BYTES } from '../lib/upload-limits';

export function MarkdownEditor({
  value,
  base = '',
  change,
  name = 'markdown',
  label = 'Markdown',
  plain = false,
  required = false,
}: {
  value: string;
  base?: string;
  change: (value: string) => void;
  name?: string;
  label?: string;
  plain?: boolean;
  required?: boolean;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [error, setError] = useState('');
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div className="markdown-editor">
      <div className="markdown-editor-header">
        <div
          className="markdown-view-tabs"
          role="tablist"
          aria-label={t('Soạn và xem trước nội dung', 'Edit and preview content')}
        >
          {(['edit', 'preview'] as const).map((mode, index) => (
            <button
              key={mode}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={id + '-' + mode}
              aria-selected={view === mode}
              aria-controls={id + '-panel'}
              tabIndex={view === mode ? 0 : -1}
              onClick={() => setView(mode)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
                setView(next === 0 ? 'edit' : 'preview');
                tabs.current[next]?.focus();
              }}
            >
              {mode === 'edit' ? t('Chỉnh sửa', 'Edit') : t('Xem trước', 'Preview')}
            </button>
          ))}
        </div>
        {!plain && (
          <label className="markdown-file-import">
            {t('Mở file .md', 'Open .md file')}
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                setError('');
                try {
                  if (file.size > MAX_UPLOAD_BYTES)
                    throw Error(t('File tối đa 20 MB.', 'Files must be 20 MB or smaller.'));
                  const text = await file.text();
                  if (text.length > 30000)
                    throw Error(
                      t(
                        'Nội dung tối đa 30.000 ký tự. File chưa được đưa vào biểu mẫu.',
                        'Content supports up to 30,000 characters. The file was not imported.',
                      ),
                    );
                  change(text);
                  setView('preview');
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : t('Không đọc được file.', 'Unable to read file.'),
                  );
                }
              }}
            />
          </label>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div
        id={id + '-panel'}
        role="tabpanel"
        aria-labelledby={id + '-' + view}
        className="markdown-editor-panel"
        tabIndex={view === 'preview' ? 0 : undefined}
      >
        {view === 'edit' ? (
          <label className="markdown-source">
            {label}
            <textarea
              name={name}
              aria-label={label}
              rows={16}
              value={value}
              required={required}
              onChange={(event) => change(event.target.value)}
              spellCheck={false}
            />
          </label>
        ) : (
          <>
            <input type="hidden" name={name} value={value} />
            <section
              className="markdown-live-preview"
              aria-label={t('Xem trước nội dung', 'Preview content')}
            >
              {value.trim() ? (
                plain ? (
                  <p className="preserve">{value}</p>
                ) : (
                  <MarkdownContent value={value} base={base} />
                )
              ) : (
                <p className="muted">
                  {t('Chưa có nội dung để xem trước.', 'Nothing to preview yet.')}
                </p>
              )}
            </section>
          </>
        )}
      </div>
      <p className="admin-help">
        {plain
          ? t('Văn bản giữ nguyên xuống dòng.', 'Plain text retains your line breaks.')
          : t(
              'Hỗ trợ tiêu đề, danh sách, bảng, liên kết và khối mã. Xem trước trước khi lưu.',
              'Headings, lists, tables, links and code blocks. Preview your content before saving.',
            )}
      </p>
    </div>
  );
}
