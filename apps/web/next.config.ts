import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // test/e2e-isolated.sh builds into .next-e2e so the dev server's .next is never touched
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@kbs/shared', '@kbs/ui-tokens'],
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: { position: 'bottom-right' },
  // F-907: deployed web calls the API through itself (NEXT_PUBLIC_API_URL=/api/v1) so the auth cookies are first-party
  // on the web domain; API_URL is the real API (server-side fetches + this proxy). Local dev keeps absolute URLs.
  async rewrites() {
    const pub = process.env.NEXT_PUBLIC_API_URL;
    const api = process.env.API_URL;
    return pub?.startsWith('/') && api ? [{ source: `${pub}/:path*`, destination: `${api}/:path*` }] : [];
  },
};

export default nextConfig;
