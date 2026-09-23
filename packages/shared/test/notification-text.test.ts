import { describe, expect, it } from 'vitest';

import { containsSensitive, misChangeBody, misChangeLine, scrubSensitiveText } from '../src';

describe('F-701 notification wording (REQ-19 §19.2)', () => {
  it('quotes raw bank values and never claims activation beyond the reported field', () => {
    expect(misChangeLine('finalDecision', 'Approve')).toBe('Final decision = "Approve"');
    expect(misChangeLine('cardActivationStatus', 'TXN ACTIVE - Rs 100')).toBe('Card activation reported as "TXN ACTIVE - Rs 100"');
    expect(misChangeLine('currentStage', '')).toBe('Current stage = not reported');
    const body = misChangeBody({ kbsRef: 'KBS-L-AAAA1111', batchRef: 'KBS-B-XYZ', batchDate: '22 Sept 2026', changes: [{ field: 'finalDecision', value: 'Approve' }, { field: 'cardActivationStatus', value: 'INACTIVE' }] });
    expect(body).toBe('Bank MIS updated KBS-L-AAAA1111 (batch KBS-B-XYZ, 22 Sept 2026): Final decision = "Approve"; Card activation reported as "INACTIVE"');
    expect(body).not.toMatch(/\bactivated\b|\bapproved\b/);
  });
});

describe('NOTIF-02 sensitive scrubbing (REQ-21 §21.1)', () => {
  it('masks PAN, account-like digit runs and mobiles; leaves amounts and refs alone', () => {
    const s = scrubSensitiveText('PAN ABCDE1234F acct 123456789012 call 9876543210 or +91 98765 43210 for ₹1,500 KBS-PR-AB12CD34');
    expect(s).not.toMatch(/ABCDE1234F|123456789012|9876543210/);
    expect(s).toContain('₹1,500');
    expect(s).toContain('KBS-PR-AB12CD34');
    expect(containsSensitive(s)).toBe(false);
    expect(containsSensitive('account 123456789012')).toBe(true);
    expect(containsSensitive('ABCDE1234F')).toBe(true);
    expect(containsSensitive('₹1,500 on 23 Sept 2026')).toBe(false);
  });
});
