import type { Metadata } from 'next';
import '../src/fonts/fonts.css';
import '../src/tokens.css';
import '../src/app.css';
import './admin.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Eric · Professional profile',
  description: 'Eric — Software Engineer. Projects, updates and contact information.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
