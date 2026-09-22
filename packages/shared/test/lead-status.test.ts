import { describe, expect, it } from 'vitest';

import { bankRemarkFields, buildLeadStatusRow, remarksPreview, type LeadStatusRowInput } from '../src/lead-status';

const base: LeadStatusRowInput = {
  id: 'L1',
  publicRef: 'KBS-L-ABC123',
  customerFullName: 'Ramesh Kumar',
  customerMobile: '+919876543210',
  bank: { id: 'B', displayName: 'HDFC Bank' },
  card: { id: 'C', name: 'Millennia' },
  createdAt: '2026-09-01T04:00:00.000Z',
  snapshot: null,
  bankReference: null,
};
const snap = (over: Record<string, unknown>) => ({
  applicationNo: '0012345',
  applicationReferenceNumber: 'REF-A1',
  currentStage: 'Decisioned Cases',
  finalDecision: 'Approve',
  cardActivationStatus: null,
  lastMatchedAt: '2026-09-15T05:00:00.000Z',
  lastMatchedBatchRef: 'KBS-M-1',
  bankCreationDate: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('F-506 LeadStatusRow shaping (REQ-14 §14.2–§14.4)', () => {
  it('never matched → all three fields Awaiting MIS Update, no bank dates or references', () => {
    const r = buildLeadStatusRow(base);
    expect(r).toMatchSnapshot();
    expect([r.stage.display, r.decision.display, r.activation.display]).toEqual(['Awaiting MIS Update', 'Awaiting MIS Update', 'Awaiting MIS Update']);
    expect(r.bankCreationDate).toEqual({ value: null, source: null, provenance: 'BANK_MIS' });
    expect(r.customer.mobileMasked).toBe('+91••••••3210');
    expect(r.actions).toEqual(['OPEN_DETAILS', 'ENTER_BANK_REFERENCE', 'SHARE_APPLICATION_LINK']);
  });

  it('§14.4: the four activation cases stay distinct and verbatim', () => {
    const cases = ['V + ACTIVE', 'TXN ACTIVE - Rs 100', 'INACTIVE', '#N/A'];
    const out = cases.map((cardActivationStatus) => buildLeadStatusRow({ ...base, snapshot: snap({ cardActivationStatus }) }).activation);
    expect(out.map((f) => f.display)).toEqual(['V + ACTIVE', 'TXN ACTIVE - Rs 100', 'INACTIVE', 'Not reported']);
    expect(out.map((f) => f.raw)).toEqual(cases);
    expect(out.map((f) => f.value)).toEqual(['V + ACTIVE', 'TXN ACTIVE - Rs 100', 'INACTIVE', null]);
    expect(out).toMatchSnapshot();
  });

  it('§14.4: decision Approve and activation INACTIVE coexist as independent fields', () => {
    const r = buildLeadStatusRow({ ...base, snapshot: snap({ cardActivationStatus: 'INACTIVE' }) });
    expect(r.decision.display).toBe('Approve');
    expect(r.activation.display).toBe('INACTIVE');
    expect(r.stage.display).toBe('Decisioned Cases');
    expect(r.stage.batchRef).toBe('KBS-M-1');
    expect(r.lastMatchedAt).toBe('2026-09-15T05:00:00.000Z');
    expect(r).toMatchSnapshot();
  });

  it('bank creation date prefers CREATION_DATE_TIME and names its source; crosswalk needs a product code', () => {
    const r = buildLeadStatusRow({ ...base, snapshot: snap({ bankCreationDateTime: '2026-09-01T09:30:00.000Z', productCode: 'MILL01' }), crosswalkedCard: { id: 'C2', name: 'Millennia (bank code)' } });
    expect(r.bankCreationDate).toEqual({ value: '2026-09-01T09:30:00.000Z', source: 'CREATION_DATE_TIME', provenance: 'BANK_MIS' });
    expect(r.card.crosswalked).toEqual({ id: 'C2', name: 'Millennia (bank code)', productCode: 'MILL01' });
    expect(buildLeadStatusRow({ ...base, snapshot: snap({}), crosswalkedCard: { id: 'C2', name: 'x' } }).card.crosswalked).toBeNull();
    expect(buildLeadStatusRow({ ...base, snapshot: snap({}) }).bankCreationDate.source).toBe('Creation Date');
  });

  it('§14.5: remarks preview takes the first non-blank grouped reason field and truncates; detail lists every field', () => {
    expect(remarksPreview(snap({ dropoffReason: '#N/A', declineCode: 'D12', reason: 'x' }))).toBe('DECLINE_CODE: D12');
    expect(remarksPreview(snap({ reason: 'a'.repeat(80) }))).toBe(`Reason: ${'a'.repeat(59)}…`);
    expect(remarksPreview(snap({}))).toBeNull();
    expect(remarksPreview(null)).toBeNull();
    const d = bankRemarkFields(snap({ declineType: 'Policy', vkycStatus: '' }));
    expect(d.remarks.find((f) => f.field === 'declineType')).toEqual({ field: 'declineType', label: 'Decline Type', raw: 'Policy', display: 'Policy' });
    expect(d.kyc.find((f) => f.field === 'vkycStatus')?.display).toBe('Not reported');
    expect(bankRemarkFields(null).kyc[0]?.display).toBe('Awaiting MIS Update');
  });
});
