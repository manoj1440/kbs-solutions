import type { Request } from 'express';

import { ACCESS_COOKIE } from '../../modules/auth/auth.controller';
import type { TokenService } from '../../modules/auth/token.service';
import { type ClientIpOptions, clientIpOf } from '../client-ip';

/** IPv6 clients are bucketed per /64 (one subscriber network), so rotating addresses inside it does not reset the budget. */
function bucketIp(ip: string): string {
  if (!ip.includes(':')) return ip;
  const groups = ip.split('::')[0]?.split(':') ?? [];
  return `${groups.slice(0, 4).join(':')}::/64`;
}

/**
 * F-908 S3: who a request counts against. A valid access token (Bearer or the web cookie) → that user, so everyone
 * behind one office NAT or the web proxy keeps their own budget. Anonymous requests → the client IP, resolved with the
 * trusted proxy hops (never a client-supplied X-Forwarded-For). Only the signature is checked here; the JWT guard
 * still decides access.
 */
export function throttleTracker(req: Request, ip: ClientIpOptions, tokens: Pick<TokenService, 'verifyAccess'>): string {
  const header = req.header('authorization');
  const token = (header?.startsWith('Bearer ') ? header.slice(7) : undefined) ?? (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  if (token) {
    try {
      return `u:${tokens.verifyAccess(token).sub}`;
    } catch {
      /* expired / forged token: count it against the address */
    }
  }
  return `ip:${bucketIp(clientIpOf(req, ip))}`;
}
