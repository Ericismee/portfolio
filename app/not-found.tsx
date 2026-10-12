'use client';
import Link from 'next/link';
import { useLanguage } from '../components/language';
export default function NotFound() {
  return <Message />;
}
function Message() {
  const { t } = useLanguage();
  return (
    <main id="view" className="card pad public-error">
      <p className="badge">404</p>
      <h1>{t('Không tìm thấy trang', 'Page not found')}</h1>
      <p>
        {t(
          'Nội dung có thể đã được gỡ hoặc chưa được xuất bản.',
          'This content may have been removed or is not published.',
        )}
      </p>
      <Link className="btn primary" href="/">
        {t('Về hồ sơ', 'Back to profile')}
      </Link>
    </main>
  );
}
