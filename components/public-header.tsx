'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { saveTheme } from '../lib/theme';
import { responsiveImage } from '../lib/image-variants';
import { Icon } from './icon';
import { FileDocument } from './file-document';
import { useLanguage } from './language';
import type { useInlineEdit } from './inline-edit';

export function PublicHeader({ editing }: { editing: ReturnType<typeof useInlineEdit> }) {
  const { t, language, toggle } = useLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('q') || '';
  const page = pathname.split('/')[1] || 'profile';
  const activePage = ['feed', 'posts'].includes(page) ? 'activity' : page;
  const router = useRouter();
  const data = editing.data;
  const profile = data.profile;
  const [search, setSearch] = useState(page === 'search' ? searchTerm : '');
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMenu(false);
    setSearch(page === 'search' ? searchTerm : '');
  }, [pathname, page, searchTerm]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu) {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    menuPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !menuPanel.current?.contains(event.target as Node) &&
        !menuButton.current?.contains(event.target as Node)
      )
        setMenu(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [menu]);
  const avatar = (size: string) => (
    <div className={'avatar ' + size}>
      {profile.avatar ? (
        <img
          {...responsiveImage(profile.avatar, '120px')}
          alt={t('Ảnh đại diện', 'Avatar') + ' ' + profile.name}
          decoding="async"
        />
      ) : (
        Array.from(profile.name)[0]
      )}
    </div>
  );
  const nav = () =>
    [
      ['/', 'profile', t('Hồ sơ', 'Profile')],
      ['/projects', 'projects', t('Dự án', 'Projects')],
      ['/activity', 'feed', t('Hoạt động', 'Activity')],
      ['/contact', 'contact', t('Liên hệ', 'Contact')],
    ].map(([href, icon, label]) => (
      <Link
        className={
          'nav-item ' + (activePage === (href === '/' ? 'profile' : href.slice(1)) ? 'active' : '')
        }
        aria-current={
          activePage === (href === '/' ? 'profile' : href.slice(1)) ? 'page' : undefined
        }
        href={href}
        key={href}
      >
        <Icon name={icon} />
        <span>{label}</span>
      </Link>
    ));
  return (
    <>
      <a className="skip-link" href="#view">
        {t('Đến nội dung', 'Skip to content')}
      </a>
      <header>
        <div className="header-inner">
          <Link
            className={'logo' + (profile.logo ? ' has-image' : '')}
            href="/"
            aria-label={profile.name}
          >
            {profile.logo ? (
              <img src={profile.logo} alt={profile.name} />
            ) : (
              Array.from(profile.name)[0]
            )}
          </Link>
          <form
            className="search"
            action="/search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(
                '/search?q=' +
                  encodeURIComponent(String(new FormData(e.currentTarget).get('q') || '')),
              );
            }}
          >
            <Icon name="search" />
            <input
              name="q"
              id="global-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Tìm kiếm', 'Search')}
              aria-label={t('Tìm kiếm', 'Search')}
            />
          </form>
          <nav aria-label={t('Điều hướng chính', 'Main navigation')}>{nav()}</nav>
          {data.showHeaderCv && data.cv && (
            <span className="header-cv-action">
              <FileDocument
                url={data.cv.url}
                name={data.cv.name}
                cv
                showDownload={false}
                triggerClassName="nav-item header-cv-trigger"
                trigger={
                  <>
                    <Icon name="feed" />
                    <span>{t('Xem CV', 'View CV')}</span>
                  </>
                }
              />
            </span>
          )}
          <button
            className="icon-btn avatar-menu-button"
            aria-label={t('Cài đặt', 'Settings')}
            title={t('Cài đặt', 'Settings')}
            aria-expanded={menu}
            aria-controls="site-menu"
            ref={menuButton}
            onClick={() => setMenu(!menu)}
          >
            {avatar('tiny')}
          </button>
          {menu && (
            <div
              className="site-menu"
              id="site-menu"
              ref={menuPanel}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button,a')) setMenu(false);
              }}
            >
              <strong className="settings-title">{t('Cài đặt', 'Settings')}</strong>
              <button
                className="theme-menu-action"
                onClick={() => {
                  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                  saveTheme(data.accent, next);
                }}
              >
                <Icon name="moon" />
                {t('Sáng / Tối', 'Dark / Light')}
              </button>
              <span className="settings-label">
                {t('Ngôn ngữ giao diện', 'Interface language')}
              </span>
              <button onClick={toggle}>{language === 'vi' ? 'English' : 'Tiếng Việt'}</button>
              {editing.isAdmin && (
                <button
                  className="theme-menu-action"
                  onClick={() => editing.setGuestPreview(!editing.guestPreview)}
                >
                  <Icon name={editing.guestPreview ? 'edit' : 'eye'} />
                  {editing.guestPreview
                    ? t('Quay lại quản trị', 'Return to admin')
                    : t('Xem như khách', 'View as guest')}
                </button>
              )}
              {editing.settings}
              <div className="settings-divider" />
              <Link href="/github">GitHub ↗</Link>
              <button onClick={() => window.print()}>{t('In hồ sơ', 'Print profile')}</button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
