import { ipInCidr, isValidCidr } from './access-policy.service';

describe('office network CIDR matching (SEC-01)', () => {
  it('matches IPv4 ranges and rejects outsiders', () => {
    expect(ipInCidr('203.0.113.42', '203.0.113.0/24')).toBe(true);
    expect(ipInCidr('203.0.114.1', '203.0.113.0/24')).toBe(false);
    expect(ipInCidr('::ffff:203.0.113.7', '203.0.113.0/24')).toBe(true);
  });
  it('matches IPv6 ranges', () => {
    expect(ipInCidr('2001:db8::1', '2001:db8::/32')).toBe(true);
    expect(ipInCidr('2001:db9::1', '2001:db8::/32')).toBe(false);
  });
  it('validates CIDR strings', () => {
    expect(isValidCidr('203.0.113.0/24')).toBe(true);
    expect(isValidCidr('203.0.113.0')).toBe(false);
    expect(isValidCidr('office-wifi')).toBe(false);
  });
});
