import { describe, expect, it } from 'vitest';

import { CorrectPaymentBody, maskTransferReference, RecordPaymentBody, transferReferenceKey } from '../src';

describe('F-605 payment contracts', () => {
  const ok = { paidAt: new Date(Date.now() - 60_000).toISOString(), amountInr: 1500, transferReference: 'UTR 1234 5678' };
  it('accepts a normal record and rejects future dates, zero amounts and junk references', () => {
    expect(RecordPaymentBody.safeParse(ok).success).toBe(true);
    expect(RecordPaymentBody.safeParse({ ...ok, paidAt: new Date(Date.now() + 86_400_000).toISOString() }).success).toBe(false);
    expect(RecordPaymentBody.safeParse({ ...ok, amountInr: 0 }).success).toBe(false);
    expect(RecordPaymentBody.safeParse({ ...ok, amountInr: 10.001 }).success).toBe(false);
    expect(RecordPaymentBody.safeParse({ ...ok, transferReference: '<script>' }).success).toBe(false);
    expect(RecordPaymentBody.safeParse({ ...ok, method: 'WIRE' }).success).toBe(false);
    expect(RecordPaymentBody.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });
  it('corrections need a reason', () => {
    expect(CorrectPaymentBody.safeParse(ok).success).toBe(false);
    expect(CorrectPaymentBody.safeParse({ ...ok, reason: 'typo in amount' }).success).toBe(true);
  });
  it('reference key ignores case and whitespace; receipts mask all but the last 4', () => {
    expect(transferReferenceKey(' utr 1234 5678 ')).toBe('UTR12345678');
    expect(transferReferenceKey('UTR12345678')).toBe(transferReferenceKey('utr 1234 5678'));
    expect(maskTransferReference('UTR12345678')).toBe('•••••••5678');
    expect(maskTransferReference('AB1')).toBe('••••');
  });
});
