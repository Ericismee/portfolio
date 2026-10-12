'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { useLanguage } from './language';

function NavigationLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className="mobile-nav-label" data-pending={pending || undefined}>
      {label}
      <span className="mobile-nav-progress" aria-hidden="true" />
    </span>
  );
}

// Live outside the page's loading boundary so links remain usable during navigation.
export function MobileNavigation() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const section = pathname?.split('/')[1] || 'profile';
  if (['admin', 'api', 'uploads', '_next'].includes(section)) return null;
  const activeSection = ['posts', 'feed'].includes(section) ? 'activity' : section;
  const items = [
    { href: '/', section: 'profile', icon: 'profile', label: t('Hồ sơ', 'Profile') },
    { href: '/projects', section: 'projects', icon: 'projects', label: t('Dự án', 'Projects') },
    { href: '/activity', section: 'activity', icon: 'feed', label: t('Hoạt động', 'Activity') },
    { href: '/github', section: 'github', icon: 'github', label: 'GitHub' },
    { href: '/contact', section: 'contact', icon: 'contact', label: t('Liên hệ', 'Contact') },
  ];
  return (
    <nav className="bottom-nav" aria-label={t('Điều hướng trên điện thoại', 'Mobile navigation')}>
      {items.map((item) => {
        const active = activeSection === item.section;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={'nav-item' + (active ? ' active' : '')}
            aria-current={active ? 'page' : undefined}
          >
            <span className="mobile-nav-icon">
              <Icon name={item.icon} />
            </span>
            <NavigationLabel label={item.label} />
          </Link>
        );
      })}
    </nav>
  );
}
