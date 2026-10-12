import { Fragment, type ReactNode } from 'react';
import { readRichText, safeMediaUrl, youtubeEmbed, type RichNode } from '../lib/rich-text';
import { LOCAL_FILE } from '../lib/file-types';
import { FileDocument } from './file-document';

export function RichContent({ value, fallback = '' }: { value: string; fallback?: string }) {
  function render(node: RichNode, key: number): ReactNode {
    const children = node.content?.map(render);
    if (node.type === 'text') {
      let text: ReactNode = node.text;
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') text = <strong>{text}</strong>;
        if (mark.type === 'italic') text = <em>{text}</em>;
        if (mark.type === 'underline') text = <u>{text}</u>;
        if (mark.type === 'strike') text = <s>{text}</s>;
        if (mark.type === 'code') text = <code>{text}</code>;
        if (mark.type === 'link' && safeMediaUrl(mark.attrs?.href))
          text = (
            LOCAL_FILE.test(String(mark.attrs?.href)) ? <FileDocument url={String(mark.attrs?.href)} name={node.text || 'Document'} /> :
            <a href={safeMediaUrl(mark.attrs?.href)} target="_blank" rel="noopener noreferrer">
              {text}
            </a>
          );
      }
      return <Fragment key={key}>{text}</Fragment>;
    }
    switch (node.type) {
      case 'doc':
        return <Fragment key={key}>{children}</Fragment>;
      case 'paragraph':
        return <p key={key}>{children?.length ? children : <br />}</p>;
      case 'heading':
        return node.attrs?.level === 3 ? (
          <h3 key={key}>{children}</h3>
        ) : (
          <h2 key={key}>{children}</h2>
        );
      case 'bulletList':
        return <ul key={key}>{children}</ul>;
      case 'orderedList':
        return <ol key={key}>{children}</ol>;
      case 'listItem':
        return <li key={key}>{children}</li>;
      case 'blockquote':
        return <blockquote key={key}>{children}</blockquote>;
      case 'codeBlock':
        return (
          <pre key={key}>
            <code>{children}</code>
          </pre>
        );
      case 'hardBreak':
        return <br key={key} />;
      case 'horizontalRule':
        return <hr key={key} />;
      case 'image':
        return safeMediaUrl(node.attrs?.src) ? (
          <img
            key={key}
            src={safeMediaUrl(node.attrs?.src)}
            alt={typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''}
            loading="lazy"
            decoding="async"
          />
        ) : null;
      case 'youtube':
        return youtubeEmbed(node.attrs?.src) ? (
          <iframe
            key={key}
            src={youtubeEmbed(node.attrs?.src)}
            title="YouTube video"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        ) : null;
      default:
        return null;
    }
  }
  return <div className="rich-content">{render(readRichText(value, fallback), 0)}</div>;
}
