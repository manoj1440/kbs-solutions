import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // test/e2e-isolated.sh builds into .next-e2e so the dev server's .next is never touched
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@kbs/shared', '@kbs/ui-tokens'],
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
