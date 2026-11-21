import type { Request } from 'express';

import { clientIpOf, resolveClientIp } from './client-ip';

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

describe('clientIpOf (F-908 S3: one more hop only for our own web proxy)', () => {
  const viaProxy = (xff: string, secret: string | undefined) =>
    ({ header: (n: string) => (n === 'x-forwarded-for' ? xff : n === 'x-kbs-proxy-secret' ? secret : undefined), socket: { remoteAddress: '10.0.0.1' } }) as unknown as Request;
  it('SEC-07: trusts the extra hop when the proxy secret matches', () => {
    expect(clientIpOf(viaProxy('198.51.100.7, 76.76.21.1', 'proxy-secret-1234567890'), { hops: 1, proxySecret: 'proxy-secret-1234567890' })).toBe('198.51.100.7');
  });
  it('SEC-07: a wrong, missing or unconfigured secret keeps the normal hop count', () => {
    expect(clientIpOf(viaProxy('spoofed, 76.76.21.1', 'wrong'), { hops: 1, proxySecret: 'proxy-secret-1234567890' })).toBe('76.76.21.1');
    expect(clientIpOf(viaProxy('spoofed, 76.76.21.1', undefined), { hops: 1, proxySecret: 'proxy-secret-1234567890' })).toBe('76.76.21.1');
    expect(clientIpOf(viaProxy('spoofed, 76.76.21.1', 'anything'), { hops: 1 })).toBe('76.76.21.1');
  });
});
