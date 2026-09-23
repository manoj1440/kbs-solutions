import { describe, expect, it } from 'vitest';

import { isProtectedRoute, routeKey } from './secure-routes';

describe('F-302 screen-capture policy (REQ-09 §9.3)', () => {
  it('SEC-02: customer, PAN/bank and payout screens are protected', () => {
    for (const s of [
      ['(telecaller)'],
      ['(telecaller)', 'record'],
      ['(advisor)', 'lead-new'],
      ['(advisor)', 'payouts'],
      ['(advisor)', 'profile'],
      ['(manager)', 'telecaller'],
      ['(manager)', 'approvals'],
      ['(gates)', 'onboarding'],
    ]) {
      expect(isProtectedRoute(s)).toBe(true);
    }
  });
  it('SEC-02: sign-in, welcome (S01–S05), catalogue, training and notifications stay capturable', () => {
    for (const s of [
      ['(auth)', 'welcome'],
      ['(auth)', 'mobile'],
      ['(auth)', 'otp'],
      [],
      ['(advisor)', 'cards'],
      ['(advisor)', 'card'],
      ['(gates)', 'training'],
      ['(gates)', 'network-blocked'],
      ['(telecaller)', 'notifications'],
      ['(manager)', 'notifications'],
    ]) {
      expect(isProtectedRoute(s)).toBe(false);
    }
  });
  it('maps nested segments to group/leaf', () => {
    expect(routeKey(['(gates)', 'training', 'module'])).toBe('(gates)/training');
    expect(routeKey(['(manager)'])).toBe('(manager)/index');
  });
});
