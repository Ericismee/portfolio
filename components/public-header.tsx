'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { saveTheme, type Theme } from '../lib/theme';
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
  const [menuTheme, setMenuTheme] = useState<Theme>('light');
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
              setMenuTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
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
              <div className="site-menu-identity">
                {avatar('tiny')}
                <div>
                  <strong>{profile.name}</strong>
                  <span>
                    {editing.isAdmin
                      ? editing.guestPreview
                        ? t('Đang xem như khách', 'Guest preview')
                        : t('Chế độ quản trị', 'Admin mode')
                      : t('Tùy chọn cho người xem', 'Visitor options')}
                  </span>
                </div>
              </div>
              <section
                className="site-menu-group"
                aria-labelledby="menu-display-title"
                data-menu-stay-open
              >
                <h2 id="menu-display-title">{t('Giao diện', 'Appearance')}</h2>
                <div className="site-menu-preference">
                  <span>
                    <Icon name={menuTheme === 'dark' ? 'moon' : 'sun'} />
                    {t('Chế độ', 'Theme')}
                  </span>
                  <div
                    className="site-menu-choice"
                    role="group"
                    aria-label={t('Chế độ giao diện', 'Color theme')}
                  >
                    {(['light', 'dark'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={menuTheme === value}
                        onClick={() => {
                          saveTheme(data.accent, value);
                          setMenuTheme(value);
                        }}
                      >
                        {value === 'light' ? t('Sáng', 'Light') : t('Tối', 'Dark')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="site-menu-preference">
                  <span>
                    <Icon name="languages" />
                    {t('Ngôn ngữ', 'Language')}
                  </span>
                  <div
                    className="site-menu-choice"
                    role="group"
                    aria-label={t('Ngôn ngữ giao diện', 'Interface language')}
                  >
                    <button
                      type="button"
                      aria-pressed={language === 'vi'}
                      onClick={() => {
                        if (language !== 'vi') toggle();
                      }}
                    >
                      VI
                    </button>
                    <button
                      type="button"
                      aria-pressed={language === 'en'}
                      onClick={() => {
                        if (language !== 'en') toggle();
                      }}
                    >
                      EN
                    </button>
                  </div>
                </div>
              </section>
              <section className="site-menu-group" aria-labelledby="menu-shortcuts-title">
                <h2 id="menu-shortcuts-title">{t('Truy cập nhanh', 'Quick links')}</h2>
                <Link className="site-menu-item" href="/github">
                  <Icon name="github" />
                  <span>GitHub</span>
                  <Icon name="next" />
                </Link>
                <button className="site-menu-item" onClick={() => window.print()}>
                  <Icon name="print" />
                  <span>{t('In hồ sơ', 'Print profile')}</span>
                </button>
              </section>
              {editing.isAdmin && (
                <section className="site-menu-group" aria-labelledby="menu-admin-title">
                  <h2 id="menu-admin-title">{t('Dành cho quản trị viên', 'Administration')}</h2>
                  <button
                    className="site-menu-item site-menu-preview"
                    onClick={() => editing.setGuestPreview(!editing.guestPreview)}
                  >
                    <Icon name={editing.guestPreview ? 'edit' : 'eye'} />
                    <span>
                      {editing.guestPreview
                        ? t('Quay lại chỉnh sửa', 'Return to editing')
                        : t('Xem như khách', 'Preview as visitor')}
                    </span>
                  </button>
                  {editing.settings}
                </section>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
