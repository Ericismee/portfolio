'use client';
import Link from 'next/link';
import { LanguageProvider, useLanguage } from '../components/language';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <LanguageProvider>
      <Message reset={reset} />
    </LanguageProvider>
  );
}
function Message({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <main className="card pad public-error">
      <h1>{t('Chưa tải được trang', 'Unable to load this page')}</h1>
      <p>{t('Vui lòng thử lại sau giây lát.', 'Please try again in a moment.')}</p>
      <div className="actions">
        <button className="btn primary" onClick={reset}>
          {t('Thử lại', 'Retry')}
        </button>
        <Link className="btn neutral" href="/">
          {t('Về hồ sơ', 'Back to profile')}
        </Link>
      </div>
    </main>
  );
}
