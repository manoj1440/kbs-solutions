import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kbs/shared', '@kbs/ui-tokens'],
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
