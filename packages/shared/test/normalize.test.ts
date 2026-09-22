import { describe, expect, it } from 'vitest';

import { normalizeBankReference, normalizePan, normalizePincode, toE164India } from '../src/normalize';

describe('normalizePincode (PIN-03, REQ-07 §7.3)', () => {
  it('keeps leading zeros and trims', () => {
    expect(normalizePincode(' 302001 ')).toBe('302001');
    expect(normalizePincode('000123')).toBe('000123');
  });
  it('rejects numbers unless padNumeric is explicitly requested', () => {
    expect(() => normalizePincode(302001)).toThrow();
    expect(normalizePincode(123, { padNumeric: true })).toBe('000123');
  });
  it('rejects non 6-digit values', () => {
    expect(() => normalizePincode('30200')).toThrow();
    expect(() => normalizePincode('3020011')).toThrow();
    expect(() => normalizePincode('30200A')).toThrow();
  });
});

describe('toE164India', () => {
  it('normalises common forms', () => {
    expect(toE164India('9876543210')).toBe('+919876543210');
    expect(toE164India('09876543210')).toBe('+919876543210');
    expect(toE164India('+91 98765 43210')).toBe('+919876543210');
    expect(toE164India('919876543210')).toBe('+919876543210');
  });
  it('rejects invalid', () => {
    expect(() => toE164India('1234567890')).toThrow();
    expect(() => toE164India('98765')).toThrow();
  });
});

describe('normalizePan / bank reference', () => {
  it('uppercases and validates PAN', () => {
    expect(normalizePan('abcde1234f')).toBe('ABCDE1234F');
    expect(() => normalizePan('ABCDE12345')).toThrow();
  });
  it('bank reference keeps exact content incl. leading zeros and case', () => {
    expect(normalizeBankReference('  0012345aB ')).toBe('0012345aB');
    expect(() => normalizeBankReference('   ')).toThrow();
  });
});
