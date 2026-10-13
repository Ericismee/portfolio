import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { readPublicServerContent } from '../lib/server-content';
import { themeBootstrap } from '../lib/theme';
import { siteOrigin } from '../lib/site-origin';
import { LanguageProvider } from '../components/language';
import { MobileNavigation } from '../components/mobile-navigation';
import { PublicShell } from '../components/public-shell';
import '../src/tokens.css';
import '../src/app.css';
import './admin.css';
import './globals.css';
// Preserve the original font bytes, while preloading the UI faces and ensuring
// a late font response replaces the metrics-adjusted fallback on a first visit.
const uiFont = localFont({
  src: [
    { path: '../src/fonts/font-3.ttf', weight: '400' },
    { path: '../src/fonts/font-4.ttf', weight: '500' },
    { path: '../src/fonts/font-5.ttf', weight: '600' },
    { path: '../src/fonts/font-6.ttf', weight: '700' },
    { path: '../src/fonts/font-7.ttf', weight: '800' },
  ],
  variable: '--font-ui-loaded',
  display: 'swap',
  adjustFontFallback: 'Arial',
});
const codeFont = localFont({
  src: [
    { path: '../src/fonts/font-0.ttf', weight: '400' },
    { path: '../src/fonts/font-1.ttf', weight: '500' },
    { path: '../src/fonts/font-2.ttf', weight: '700' },
  ],
  variable: '--font-code-loaded',
  display: 'swap',
  preload: false,
});
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'Eric | Home',
  description: 'Eric — Software Engineer. Projects, updates and contact information.',
};
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') || undefined;
  const content = await readPublicServerContent();
  const { theme, accent, density } = content;
  return (
    <html
      lang="en"
      className={`${uiFont.variable} ${codeFont.variable}`}
      data-theme={theme}
      style={{ '--accent': accent, colorScheme: theme } as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          id="theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body className={density === 'compact' ? 'compact' : undefined}>
        <LanguageProvider>
          <PublicShell content={content}>{children}</PublicShell>
          <MobileNavigation />
        </LanguageProvider>
      </body>
    </html>
  );
}
