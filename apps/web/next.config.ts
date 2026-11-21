import type { NextConfig } from 'next';

// F-908 S7: the client calls the API from the browser. Deployed it is same-origin (/api/v1 proxy); locally it is an
// absolute URL (http://localhost:4000), which connect-src must allow. Files (S3 presigned URLs) open in a new tab via
// window.open, which this page's CSP does not govern, so no storage origin is needed here.
function apiOrigin(): string {
  const pub = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  if (pub.startsWith('/')) return '';
  try {
    return ` ${new URL(pub).origin}`;
  } catch {
    return '';
  }
}

// Enforced: no framing (clickjacking). Report-only: the fuller policy, to watch before enforcing. Next's inline
// bootstrap scripts and the theme script in layout.tsx need 'unsafe-inline' until nonces are wired.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self'${apiOrigin()}`,
  "font-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // F-908 P1: internal workspace + the public /verify page (shows a name) must never be indexed.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig: NextConfig = {
  // test/e2e-isolated.sh builds into .next-e2e so the dev server's .next is never touched
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@kbs/shared', '@kbs/ui-tokens'],
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: { position: 'bottom-right' },
  // F-907: deployed web calls the API through itself (NEXT_PUBLIC_API_URL=/api/v1) so the auth cookies are first-party
  // on the web domain; API_URL is the real API (server-side fetches + this proxy). Local dev keeps absolute URLs.
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    const pub = process.env.NEXT_PUBLIC_API_URL;
    const api = process.env.API_URL;
    return pub?.startsWith('/') && api ? [{ source: `${pub}/:path*`, destination: `${api}/:path*` }] : [];
  },
};

export default nextConfig;
