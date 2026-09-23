import { describe, expect, it } from 'vitest';

import { agentCodeInput, amountInput, digitsOnly, ifscInput, mobileInput, normalizeBankReference, normalizePan, normalizePincode, panInput, toE164India } from '../src/normalize';

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

describe('typing-time input masks', () => {
  it('digitsOnly strips non-digits and caps length', () => {
    expect(digitsOnly('98a76 54')).toBe('987654');
    expect(digitsOnly('3020019', 6)).toBe('302001');
    expect(digitsOnly('')).toBe('');
  });
  it('mobileInput keeps ≤12 digits so 91/0 prefixes survive to toE164India', () => {
    expect(mobileInput('abc98765 43210')).toBe('9876543210');
    expect(mobileInput('+91 98765 43210')).toBe('919876543210');
    expect(mobileInput('0987654321099')).toBe('098765432109');
    expect(toE164India(mobileInput('+91 98765 43210'))).toBe('+919876543210');
  });
  it('panInput uppercases, strips non-alphanumerics, caps 10', () => {
    expect(panInput('abcde1234f')).toBe('ABCDE1234F');
    expect(panInput('abc-de!1234f99')).toBe('ABCDE1234F');
  });
  it('ifscInput uppercases, strips non-alphanumerics, caps 11', () => {
    expect(ifscInput('hdfc0-0001234')).toBe('HDFC0000123');
  });
  it('agentCodeInput uppercases, strips symbols, caps 12', () => {
    expect(agentCodeInput('kbs-mgr-01!!')).toBe('KBSMGR01');
  });
  it('amountInput allows digits with one decimal point', () => {
    expect(amountInput('1,500.50')).toBe('1500.50');
    expect(amountInput('12.34.56')).toBe('12.3456');
    expect(amountInput('abc')).toBe('');
  });
});
