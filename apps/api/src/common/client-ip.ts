import { timingSafeEqual } from 'node:crypto';

import type { Request } from 'express';

/** Header the web app's server-side proxy (Vercel rewrite → API) sends so the API can trust one more X-Forwarded-For hop. */
export const PROXY_SECRET_HEADER = 'x-kbs-proxy-secret';

/** Resolve the client IP honouring at most `hops` trusted reverse proxies (never trust XFF blindly). */
export function resolveClientIp(req: Request, hops: number): string {
  const socketIp = req.socket?.remoteAddress ?? '0.0.0.0';
  if (hops <= 0) return normalizeIp(socketIp);
  const xff = req.header('x-forwarded-for');
  if (!xff) return normalizeIp(socketIp);
  const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
  // The last `hops` entries were appended by our proxies; the one before them is the client.
  const idx = Math.max(0, parts.length - hops);
  return normalizeIp(parts[idx] ?? socketIp);
}

export interface ClientIpOptions {
  /** Reverse proxies in front of the API itself (Render's load balancer = 1). */
  hops: number;
  /** F-908 S3: shared secret of the web proxy; a request carrying it came through one more trusted hop. */
  proxySecret?: string;
}

/**
 * F-908 S3: like `resolveClientIp`, plus one extra trusted hop when the request proves (constant-time secret compare)
 * that it came through our own web proxy. Without the proof, every web visitor would share the proxy's address.
 */
export function clientIpOf(req: Request, opts: ClientIpOptions): string {
  return resolveClientIp(req, opts.hops + (viaTrustedProxy(req, opts.proxySecret) ? 1 : 0));
}

export function viaTrustedProxy(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const sent = req.header(PROXY_SECRET_HEADER);
  if (!sent) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
