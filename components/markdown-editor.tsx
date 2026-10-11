'use client';
import { useState } from 'react';
import { MarkdownContent } from './markdown-content';
import { useLanguage } from './language';

export function MarkdownEditor({
  value,
  base,
  change,
}: {
  value: string;
  base: string;
  change: (value: string) => void;
}) {
  const { t } = useLanguage();
  const [view, setView] = useState('split');
  return (
    <div className="markdown-editor">
      <div className="markdown-view-tabs" aria-label={t('Chế độ Markdown', 'Markdown view')}>
        {(['write', 'preview', 'split'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
          >
            {
              {
                write: t('Soạn Markdown', 'Write Markdown'),
                preview: t('Xem trước', 'Preview'),
                split: t('Soạn & xem trước', 'Write & preview'),
              }[mode]
            }
          </button>
        ))}
      </div>
      <div className={'markdown-editor-panes markdown-view-' + view}>
        {view !== 'preview' ? (
          <label className="markdown-source">
            Markdown
            <textarea
              name="markdown"
              aria-label="Markdown"
              rows={16}
              value={value}
              onChange={(e) => change(e.target.value)}
              spellCheck={false}
            />
          </label>
        ) : (
          <input type="hidden" name="markdown" value={value} />
        )}
        {view !== 'write' && (
          <section
            className="markdown-live-preview"
            aria-label={t('Xem trước nội dung', 'Preview content')}
          >
            <h4>{t('Xem trước nội dung', 'Preview content')}</h4>
            {value.trim() ? (
              <MarkdownContent value={value} base={base} />
            ) : (
              <p className="muted">
                {t(
                  'Nội dung sẽ hiển thị tại đây khi bạn nhập.',
                  'Your formatted content appears here as you type.',
                )}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
