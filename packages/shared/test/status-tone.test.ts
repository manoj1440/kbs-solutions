import { describe, expect, it } from 'vitest';

import { activationBucket, AWAITING_MIS_UPDATE, decisionBucket, NOT_REPORTED, payoutStateLabel, payoutStateTone, statusTone, type StatusField } from '../src';

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
  it('F-811: business buckets accept every spelling banks use (same rule on dashboards, leads and MIS)', () => {
    for (const v of ['Approve', 'Approved', 'APPROVED']) expect(decisionBucket(v)).toBe('approved');
    for (const v of ['Decline', 'Rejected']) expect(decisionBucket(v)).toBe('declined');
    expect(decisionBucket('IPA')).toBe('inProcess');
    for (const v of ['V + ACTIVE', 'TXN ACTIVE - Rs 100']) expect(activationBucket(v)).toBe('active');
    for (const v of ['INACTIVE', 'Not Activated']) expect(activationBucket(v)).toBe('inactive');
    expect(activationBucket('Card Dispatched')).toBeNull();
  });
  it('payout states: one vocabulary for web and mobile', () => {
    expect(payoutStateTone('PAID')).toBe('success');
    for (const s of ['REJECTED', 'ON_HOLD', 'CANCELLED', 'VOID']) expect(payoutStateTone(s)).toBe('destructive');
    expect(payoutStateTone('ELIGIBLE_AVAILABLE')).toBe('info');
    expect(payoutStateTone('PENDING_HOLD')).toBe('warning');
    expect(payoutStateLabel('PENDING_APPROVALS')).toBe('Pending approvals');
  });
});
