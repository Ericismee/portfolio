import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { getDatabase } from '../lib/database';
import { themeBootstrap } from '../lib/theme';
import '../src/fonts/fonts.css';
import '../src/tokens.css';
import '../src/app.css';
import './admin.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Eric | Home',
  description: 'Eric — Software Engineer. Projects, updates and contact information.',
};
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme, accent } = (await (await getDatabase()).read()).data;
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
