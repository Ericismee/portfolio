import type { NextConfig } from 'next';
import { contentSecurityPolicy } from './lib/security-headers';
const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['node:sqlite'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy('', process.env.NODE_ENV === 'development'),
          },
        ],
      },
    ];
  },
};
export default config;
