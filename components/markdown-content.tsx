import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownUrl } from '../lib/markdown';
export function MarkdownContent({ value, base = '' }: { value: string; base?: string }) {
  return (
    <div className="markdown-content">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url, key) => markdownUrl(url, base, key === 'src')}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === 'string' && src ? (
              <img src={src} alt={alt || ''} loading="lazy" />
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
