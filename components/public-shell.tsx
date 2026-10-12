'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Content } from '../lib/schema';
import { applyTheme, readTheme } from '../lib/theme';
import { useInlineEdit } from './inline-edit';
import { PublicHeader } from './public-header';

type Editing = ReturnType<typeof useInlineEdit>;
const PublicContext = createContext<{
  editing: Editing;
  syncContent: (content: Content) => void;
} | null>(null);

export function usePublicEditing(content: Content) {
  const context = useContext(PublicContext);
  if (!context) throw Error('Public shell is missing');
  const { syncContent } = context;
  useEffect(() => syncContent(content), [content, syncContent]);
  return context.editing;
}

function PublicFrame({ content, children }: { content: Content; children: React.ReactNode }) {
  const [current, syncContent] = useState(content);
  const editing = useInlineEdit(current);
  const { accent, theme, density } = editing.data;
  useEffect(() => {
    applyTheme(accent, readTheme(theme));
    document.body.classList.toggle('compact', density === 'compact');
  }, [accent, theme, density]);
  return (
    <PublicContext.Provider value={{ editing, syncContent }}>
      <PublicHeader editing={editing} />
      {children}
      {editing.dialog}
      {editing.notice}
    </PublicContext.Provider>
  );
}

export function PublicShell({
  content,
  children,
}: {
  content: Content;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const section = pathname?.split('/')[1] || '';
  if (['admin', 'api', 'uploads', '_next'].includes(section)) return children;
  return <PublicFrame content={content}>{children}</PublicFrame>;
}
