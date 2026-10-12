'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Content } from '../lib/schema';
import { applyTheme, readTheme } from '../lib/theme';
import { useInlineEdit } from './inline-edit';
import { PublicHeader } from './public-header';
import { requestPageRefresh } from '../lib/page-refresh';
import { PullToRefresh } from './pull-to-refresh';
import { useLanguage } from './language';

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
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const refresh = useCallback(() => {
    if (document.querySelector('dialog[open]')) return;
    if (!navigator.onLine) {
      setRefreshMessage(t('Bạn đang ngoại tuyến.', 'You are offline.'));
      return;
    }
    setRefreshing(true);
    setRefreshMessage('');
    void requestPageRefresh()
      .then(
        () => setRefreshMessage(t('Đã cập nhật', 'Up to date')),
        () =>
          setRefreshMessage(
            t('Chưa cập nhật được. Hãy thử lại.', 'Could not refresh. Please try again.'),
          ),
      )
      .finally(() => setRefreshing(false));
  }, [t]);
  useEffect(() => {
    if (!refreshMessage) return;
    const timer = setTimeout(() => setRefreshMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [refreshMessage]);
  const { accent, theme, density } = editing.data;
  useEffect(() => {
    applyTheme(accent, readTheme(theme));
    document.body.classList.toggle('compact', density === 'compact');
  }, [accent, theme, density]);
  return (
    <PublicContext.Provider value={{ editing, syncContent }}>
      <PublicHeader editing={editing} refresh={refresh} refreshing={refreshing} />
      <PullToRefresh refresh={refresh} refreshing={refreshing} message={refreshMessage} />
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
