'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { RichContent } from './rich-content';
import { useLanguage } from './language';
import { MarkdownContent } from './markdown-content';

export function PostBody({
  value,
  text,
  detail = false,
  markdown = '',
  base = '',
}: {
  value: string;
  text: string;
  detail?: boolean;
  markdown?: string;
  base?: string;
}) {
  const { t } = useLanguage();
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    if (!content.current || detail) return;
    const node = content.current;
    const measure = () => setOverflow(node.getBoundingClientRect().height > 322);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, text, detail, markdown]);
  return (
    <>
      <div
        id={id}
        tabIndex={-1}
        onFocusCapture={(event) => {
          // Keyboard users must be able to see links that receive focus below the excerpt.
          if (!detail && overflow && !(event.target as HTMLElement).closest('.post-fade-expand'))
            setExpanded(true);
        }}
        className={
          'post-body' +
          (!detail && !expanded ? ' is-collapsed' : '') +
          (overflow ? ' has-overflow' : '')
        }
      >
        <div ref={content}>
          {markdown ? (
            <MarkdownContent value={markdown} base={base} />
          ) : value ? (
            <RichContent value={value} fallback={text} />
          ) : (
            <p className="preserve">{text}</p>
          )}
        </div>
        {!detail && !expanded && overflow && (
          <button
            type="button"
            className="post-fade-expand"
            aria-label={t('Mở rộng bài viết', 'Expand post')}
            aria-controls={id}
            aria-expanded={false}
            onClick={() => {
              setExpanded(true);
              content.current?.parentElement?.focus({ preventScroll: true });
            }}
          />
        )}
      </div>
      {!detail && (
        <button
          type="button"
          className="text-action post-expand"
          style={{ visibility: overflow ? 'visible' : 'hidden' }}
          disabled={!overflow}
          aria-hidden={!overflow}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('Thu gọn', 'Show less') : t('Xem thêm', 'Read more')}
        </button>
      )}
    </>
  );
}
