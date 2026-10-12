import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownUrl } from '../lib/markdown';
import { LOCAL_FILE } from '../lib/file-types';
import { FileDocument } from './file-document';
export function MarkdownContent({ value, base = '' }: { value: string; base?: string }) {
  return (
    <div className="markdown-content">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url, key) => markdownUrl(url, base, key === 'src')}
        components={{
          a: ({ href, children }) =>
            href && LOCAL_FILE.test(href) ? (
              <FileDocument
                url={href}
                name={typeof children === 'string' ? children : 'Document'}
              />
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          img: ({ src, alt }) =>
            typeof src === 'string' && src ? (
              <img src={src} alt={alt || ''} loading="lazy" decoding="async" />
            ) : null,
          table: ({ children }) => (
            <div className="markdown-table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {value}
      </Markdown>
    </div>
  );
}
