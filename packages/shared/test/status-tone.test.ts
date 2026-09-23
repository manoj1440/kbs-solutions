import { describe, expect, it } from 'vitest';

import { AWAITING_MIS_UPDATE, NOT_REPORTED, payoutStateLabel, payoutStateTone, statusTone, type StatusField } from '../src';

const f = (display: string, value: string | null = null): StatusField => ({ display, value, raw: value, provenance: 'BANK_MIS', asOf: null }) as StatusField;

describe('F-803 status tones (REQ-20 §20.2, VIEW-01)', () => {
  it('VIEW-01: "Not reported" and "Awaiting MIS Update" are different text and both neutral', () => {
    expect(f(NOT_REPORTED).display).not.toBe(f(AWAITING_MIS_UPDATE).display);
    for (const k of ['stage', 'decision', 'activation'] as const) {
      expect(statusTone(k, f(NOT_REPORTED))).toBe('unknown');
      expect(statusTone(k, f(AWAITING_MIS_UPDATE))).toBe('unknown');
    }
  });
  it('a reported Inprocess decision is not neutral (never confused with "Awaiting MIS Update")', () => {
    expect(statusTone('decision', f('Inprocess', 'Inprocess'))).toBe('warning');
    expect(statusTone('decision', f('Approve', 'APPROVE'))).toBe('success');
    expect(statusTone('decision', f('Decline', 'Decline'))).toBe('destructive');
    expect(statusTone('activation', f('Active', 'ACTIVE'))).toBe('success');
    expect(statusTone('activation', f('Inactive', 'INACTIVE'))).toBe('warning');
    expect(statusTone('stage', f('Login', 'Login'))).toBe('info');
  });
  it('payout states: one vocabulary for web and mobile', () => {
    expect(payoutStateTone('PAID')).toBe('success');
    for (const s of ['REJECTED', 'ON_HOLD', 'CANCELLED', 'VOID']) expect(payoutStateTone(s)).toBe('destructive');
    expect(payoutStateTone('ELIGIBLE_AVAILABLE')).toBe('info');
    expect(payoutStateTone('PENDING_HOLD')).toBe('warning');
    expect(payoutStateLabel('PENDING_APPROVALS')).toBe('Pending approvals');
  });
});
