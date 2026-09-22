import { CryptoService } from './crypto.service';

const KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

describe('CryptoService (REQ-21 §21.1 encryption at rest; REQ-04 §4.1 OTP hashing)', () => {
  const svc = new CryptoService(KEY, 'pepper');

  it('round-trips PAN encryption with a fresh IV each time', () => {
    const a = svc.encrypt('ABCDE1234F');
    const b = svc.encrypt('ABCDE1234F');
    expect(a).not.toBe(b);
    expect(svc.decrypt(a)).toBe('ABCDE1234F');
    expect(svc.decrypt(b)).toBe('ABCDE1234F');
  });

  it('rejects tampered ciphertext', () => {
    const c = svc.encrypt('123456789012');
    const tampered = c.slice(0, -2) + (c.endsWith('A') ? 'B' : 'A') + c.slice(-1);
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('OTP hash is bound to the challenge id and never equals the code', () => {
    const h1 = svc.hashOtp('123456', 'c1');
    const h2 = svc.hashOtp('123456', 'c2');
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain('123456');
    expect(svc.safeEqual(h1, svc.hashOtp('123456', 'c1'))).toBe(true);
  });

  it('generates 6-digit OTPs', () => {
    for (let i = 0; i < 50; i++) expect(svc.randomOtp()).toMatch(/^\d{6}$/);
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => new CryptoService('c2hvcnQ=', 'p')).toThrow();
  });
});
