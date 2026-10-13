export function contentSecurityPolicy(nonce = '', development = false) {
  if (nonce && !/^[A-Za-z0-9+/]+={0,2}$/.test(nonce)) throw Error('Invalid CSP nonce');
  const scripts = development
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : nonce
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : "'self'";
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' blob:",
    "connect-src 'self' blob: https://vercel.com/api/blob https://vercel.com/api/blob/ https://blob.vercel-storage.com https://*.blob.vercel-storage.com",
    "worker-src 'self'",
    'frame-src https://www.youtube-nocookie.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}
