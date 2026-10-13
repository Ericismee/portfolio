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

export function PublicHeader({
  editing,
  refresh,
  refreshing,
}: {
  editing: ReturnType<typeof useInlineEdit>;
  refresh: () => void;
  refreshing: boolean;
}) {
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
            aria-label={t('Cập nhật trang', 'Refresh page') + ' · ' + profile.name}
            title={t('Cập nhật trang', 'Refresh page')}
            aria-busy={refreshing}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              refresh();
            }}
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
            onClick={() => {
              setMenu(!menu);
            }}
          >
            {avatar('tiny')}
          </button>
          {menu && (
            <div
              className="site-menu"
              id="site-menu"
              ref={menuPanel}
              aria-label={t('Tùy chọn trang', 'Page options')}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('button,a') && !target.closest('[data-menu-stay-open]'))
                  setMenu(false);
              }}
              onBlur={(event) => {
                if (
                  event.relatedTarget &&
                  !event.currentTarget.contains(event.relatedTarget as Node) &&
                  event.relatedTarget !== menuButton.current
                )
                  setMenu(false);
              }}
            >
              <strong className="settings-title">{t('Cài đặt', 'Settings')}</strong>
              <button
                className="site-menu-item"
                onClick={() => {
                  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                  saveTheme(data.accent, next);
                }}
              >
                <Icon name="moon" />
                <span>{t('Sáng / Tối', 'Dark / Light')}</span>
              </button>
              <span className="settings-label">
                {t('Ngôn ngữ giao diện', 'Interface language')}
              </span>
              <button className="site-menu-item" onClick={toggle}>
                <Icon name="languages" />
                <span>{language === 'vi' ? 'English' : 'Tiếng Việt'}</span>
              </button>
              {editing.isAdmin && (
                <button
                  className="site-menu-item"
                  onClick={() => editing.setGuestPreview(!editing.guestPreview)}
                >
                  <Icon name={editing.guestPreview ? 'edit' : 'eye'} />
                  <span>
                    {editing.guestPreview
                      ? t('Quay lại quản trị', 'Return to admin')
                      : t('Xem như khách', 'View as guest')}
                  </span>
                </button>
              )}
              {editing.settings && (
                <>
                  <div className="settings-divider" />
                  {editing.settings}
                </>
              )}
              <div className="settings-divider" />
              <Link className="site-menu-item" href="/github">
                <Icon name="github" />
                <span>GitHub ↗</span>
              </Link>
              <button className="site-menu-item" onClick={() => window.print()}>
                <Icon name="print" />
                <span>{t('In hồ sơ', 'Print profile')}</span>
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
