import { describe, expect, it } from 'vitest';

import { maskAccount, maskMobile, maskName, maskPan } from '../src/mask';
import { formatInr } from '../src/money';
import { isPublicRef, makePublicRef, RefPrefix } from '../src/refs';

describe('masking (REQ-21 §21.1)', () => {
  it('masks mobile keeping last 4', () => {
    expect(maskMobile('+919876543210')).toBe('+91••••••3210');
  });
  it('masks PAN keeping last 5 chars pattern', () => {
    expect(maskPan('ABCDE1234F')).toBe('•••••1234F');
  });
  it('masks account keeping last 4', () => {
    expect(maskAccount('123456789012')).toBe('••••••••9012');
  });
  it('masks names for previews', () => {
    expect(maskName('Ramesh Kumar')).toBe('R••••••');
  });
});

describe('public refs (ADR-012)', () => {
  it('generates prefixed Crockford refs', () => {
    const r = makePublicRef(RefPrefix.LEAD);
    expect(r.startsWith('KBS-L-')).toBe(true);
    expect(isPublicRef(r, RefPrefix.LEAD)).toBe(true);
    expect(r.slice(6)).not.toMatch(/[ILOU]/);
  });
});

describe('formatInr', () => {
  it('uses Indian grouping', () => {
    expect(formatInr('1234567.5')).toBe('₹12,34,567.50');
    expect(formatInr(999)).toBe('₹999.00');
    expect(formatInr(0, { decimals: 0, symbol: false })).toBe('0');
  });
});
