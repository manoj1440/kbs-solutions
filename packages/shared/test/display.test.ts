import { describe, expect, it } from 'vitest';

import { bankValueDisplay, isBlankBankValue, misStatusField } from '../src/display';

describe('bankValueDisplay (INV-02, REQ-13 §13.6)', () => {
  it('MIS-04: never matched → Awaiting MIS Update', () => {
    expect(bankValueDisplay(null, false)).toBe('Awaiting MIS Update');
    expect(bankValueDisplay('Approve', false)).toBe('Awaiting MIS Update');
  });
  it('MIS-03: matched but #N/A / blank → Not reported', () => {
    expect(bankValueDisplay('#N/A', true)).toBe('Not reported');
    expect(bankValueDisplay('', true)).toBe('Not reported');
    expect(bankValueDisplay('  ', true)).toBe('Not reported');
    expect(bankValueDisplay(null, true)).toBe('Not reported');
  });
  it('MIS-02: raw values verbatim and distinct', () => {
    expect(bankValueDisplay('V + ACTIVE', true)).toBe('V + ACTIVE');
    expect(bankValueDisplay('TXN ACTIVE - Rs 100', true)).toBe('TXN ACTIVE - Rs 100');
    expect(bankValueDisplay('INACTIVE', true)).toBe('INACTIVE');
    expect(bankValueDisplay('Decisioned Cases and Card setup completed', true)).toBe(
      'Decisioned Cases and Card setup completed',
    );
  });
  it('custom blank tokens are respected', () => {
    expect(isBlankBankValue('NIL', ['NIL'])).toBe(true);
    expect(isBlankBankValue('#N/A', ['NIL'])).toBe(false);
  });
  it('misStatusField carries provenance and asOf only when matched', () => {
    const f = misStatusField('Approve', true, '2026-09-22T00:00:00Z', 'KBS-B-ABCDEFGH');
    expect(f).toMatchObject({ value: 'Approve', provenance: 'BANK_MIS', display: 'Approve', batchRef: 'KBS-B-ABCDEFGH' });
    const g = misStatusField(null, false, null, null);
    expect(g.display).toBe('Awaiting MIS Update');
    expect(g.asOf).toBeNull();
  });
});
