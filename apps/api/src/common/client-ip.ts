import type { Request } from 'express';

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

export function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
