import { describe, expect, it } from 'vitest';

import { AdvisorProfileView } from '../src/schemas/onboarding';

const ok = {
  fullName: 'Adv',
  mobileMasked: '+91••••••1234',
  email: null,
  identity: { status: 'VERIFIED', verifiedAt: '2026-09-01T00:00:00.000Z', method: 'DIGILOCKER' },
  reporting: { parent: { id: 'u1', fullName: 'Mgr', role: 'MANAGER' }, agentCode: 'KBS-MGR1', since: '2026-09-01T00:00:00.000Z', pendingChange: null },
  bank: { bankName: 'HDFC Bank', accountLast4: '9012', ifsc: 'HDFC0001234' },
  onboarding: { step: 'DONE', submittedAt: null, reviewOutcome: null },
  support: { contact: 'support@kbs.example' },
  idCard: { publicRef: 'KBS-ID-1', status: 'ACTIVE' },
};

describe('F-410 AdvisorProfileView schema (REQ-25 §25.1)', () => {
  it('accepts the minimal profile shape', () => {
    expect(AdvisorProfileView.parse(ok)).toEqual(ok);
  });
  it('rejects any sensitive file, URL, full account number or identity payload leaking into the DTO', () => {
    expect(() => AdvisorProfileView.parse({ ...ok, chequeFile: { id: 'f1' } })).toThrow();
    expect(() => AdvisorProfileView.parse({ ...ok, bank: { ...ok.bank, accountNumber: '123456789012' } })).toThrow();
    expect(() => AdvisorProfileView.parse({ ...ok, bank: { ...ok.bank, accountLast4: '123456789012' } })).toThrow();
    expect(() => AdvisorProfileView.parse({ ...ok, identity: { ...ok.identity, summary: { name: 'x' } } })).toThrow();
    expect(() => AdvisorProfileView.parse({ ...ok, identity: { ...ok.identity, fileUrl: 'https://x' } })).toThrow();
    expect(() => AdvisorProfileView.parse({ ...ok, pan: 'ABCDE1234F' })).toThrow();
  });
});
