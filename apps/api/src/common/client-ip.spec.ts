import type { Request } from 'express';

import { resolveClientIp } from './client-ip';

const req = (xff: string | undefined, socketIp = '10.0.0.1') =>
  ({ header: (n: string) => (n === 'x-forwarded-for' ? xff : undefined), socket: { remoteAddress: socketIp } }) as unknown as Request;

describe('resolveClientIp (F-301: never trust XFF blindly)', () => {
  it('ignores X-Forwarded-For when no proxy hops are trusted', () => {
    expect(resolveClientIp(req('203.0.113.9'), 0)).toBe('10.0.0.1');
  });
  it('takes the entry appended before the trusted hops', () => {
    // XFF = [client-supplied junk…, client (added by proxy1), proxy1 (added by proxy2)]; socket = proxy2
    expect(resolveClientIp(req('spoofed, 198.51.100.1, 203.0.113.9'), 2)).toBe('198.51.100.1');
    expect(resolveClientIp(req('198.51.100.1'), 1)).toBe('198.51.100.1');
    expect(resolveClientIp(req('spoofed, 198.51.100.1'), 1)).toBe('198.51.100.1');
  });
  it('strips IPv4-mapped prefixes', () => {
    expect(resolveClientIp(req(undefined, '::ffff:192.0.2.5'), 0)).toBe('192.0.2.5');
  });
});
