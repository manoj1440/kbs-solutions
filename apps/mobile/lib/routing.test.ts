import type { Gates, UserSummary } from '@kbs/shared';
import { describe, expect, it } from 'vitest';

import { routeFor } from './routing';

const user = (role: UserSummary['role']): UserSummary => ({ id: 'u', publicRef: 'KBS-U-X', role, status: 'ACTIVE', fullName: 'T', mobileMasked: '+91••••••1234', email: null, employeeCode: null, reportingParent: null });
const gates = (o: Partial<Gates> = {}): Gates => ({
  account: { active: true, reason: null },
  training: { required: false, passed: true, status: null, deadlineAt: null, currentModuleSequence: null, reason: null },
  network: { required: false, allowed: true, reason: null },
  onboarding: { required: false, complete: true, step: null },
  ...o,
});

describe('routeFor (REQ-04 §4.2 role-dependent first login)', () => {
  it('TRAIN-03: Telecaller with unpassed training goes to the training gate', () => {
    expect(routeFor(user('TELECALLER'), gates({ training: { required: true, passed: false, status: 'IN_PROGRESS', deadlineAt: null, currentModuleSequence: 2, reason: 'IN_PROGRESS' } }))).toBe('/(gates)/training');
  });
  it('SEC-01: trained Telecaller outside office network goes to network-blocked; Advisor is never network gated', () => {
    expect(routeFor(user('TELECALLER'), gates({ training: { required: true, passed: true, status: 'PASSED', deadlineAt: null, currentModuleSequence: 3, reason: null }, network: { required: true, allowed: false, reason: 'OUTSIDE_OFFICE_NETWORK' } }))).toBe('/(gates)/network-blocked');
    expect(routeFor(user('ADVISOR'), gates({ network: { required: true, allowed: false, reason: 'OUTSIDE_OFFICE_NETWORK' } }))).toBe('/(advisor)');
  });
  it('Advisor pending onboarding goes to onboarding; Manager goes to team', () => {
    expect(routeFor(user('ADVISOR'), gates({ onboarding: { required: true, complete: false, step: 'BANK' } }))).toBe('/(gates)/onboarding');
    expect(routeFor(user('MANAGER'), gates())).toBe('/(manager)');
  });
  it('deactivated accounts land on the deactivated screen', () => {
    expect(routeFor(user('TELECALLER'), gates({ account: { active: false, reason: 'DEACTIVATED' } }))).toBe('/(gates)/deactivated');
  });
});
