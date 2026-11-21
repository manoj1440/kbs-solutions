import type { MetadataRoute } from 'next';

/** F-908 P1: an internal workspace — ask every crawler to stay out. Pages also send noindex (meta + X-Robots-Tag). */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
