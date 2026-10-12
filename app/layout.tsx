import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { readServerContent } from '../lib/server-content';
import { themeBootstrap } from '../lib/theme';
import { siteOrigin } from '../lib/site-origin';
import '../src/fonts/fonts.css';
import '../src/tokens.css';
import '../src/app.css';
import './admin.css';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'Eric | Home',
  description: 'Eric — Software Engineer. Projects, updates and contact information.',
};
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme, accent } = (await readServerContent()).data;
  return (
    <html
      lang="en"
      data-theme={theme}
      style={{ '--accent': accent, colorScheme: theme } as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <script id="theme-bootstrap" dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
