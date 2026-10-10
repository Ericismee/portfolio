import type { ReactNode } from 'react';

export const socialLabels: Record<string, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X',
  x: 'X',
  email: 'Email',
  website: 'Website',
};
export function SocialLogo({ name }: { name: string }) {
  const marks: Record<string, ReactNode> = {
    github: (
      <path
        fill="currentColor"
        stroke="none"
        d="M12 .8a11.2 11.2 0 0 0-3.54 21.82c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.72.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.97 0 0 .95-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.69.12 2.97.72.79 1.15 1.79 1.15 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.11c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z"
      />
    ),
    linkedin: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="2" fill="currentColor" stroke="none" />
        <g fill="white" stroke="none">
          <circle cx="7" cy="7" r="1.5" />
          <path d="M5.7 10h2.6v8.5H5.7zM10.4 10H13v1.2c.6-.9 1.5-1.5 2.8-1.5 2.5 0 3.2 1.6 3.2 4v4.8h-2.7v-4.3c0-1.2-.2-2.1-1.5-2.1-1.4 0-1.7 1-1.7 2.1v4.3h-2.7z" />
        </g>
      </>
    ),
    facebook: (
      <path
        fill="currentColor"
        stroke="none"
        d="M14 22v-9h3l.5-3H14V8c0-.9.3-1.5 1.6-1.5H18V3.2C17.6 3.1 16.4 3 15.2 3 12.5 3 11 4.6 11 7.5V10H8v3h3v9z"
      />
    ),
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    tiktok: <path d="M14 3v12a4 4 0 1 1-4-4M14 3c.5 3 2.5 5 6 5" strokeWidth="3" />,
    youtube: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="4" />
        <path d="m10 9 6 3-6 3z" fill="currentColor" stroke="none" />
      </>
    ),
    x: <path d="m4 3 16 18M20 3 4 21M4 3h4l12 18h-4Z" />,
    email: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
  };
  const fallback = (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  );
  return (
    <span className="social-logo" data-brand={name} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {marks[name === 'twitter' ? 'x' : name] || fallback}
      </svg>
    </span>
  );
}
