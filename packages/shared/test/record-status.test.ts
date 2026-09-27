import { describe, expect, it } from 'vitest';

import { QueueQuery, RECORD_STATUS_LABELS, RECORD_STATUSES, recordStatusOf } from '../src';

const r = (over: Partial<Parameters<typeof recordStatusOf>[0]> = {}) => ({ reviewStatus: 'ACCEPTED', suppressed: false, assignedTelecallerUserId: 'tc', interactionStatus: 'UNTOUCHED', ...over });

describe('F-808 calling record status', () => {
  it('import review wins, then do-not-contact, then unassigned, then the interaction status', () => {
    expect(recordStatusOf(r({ reviewStatus: 'EXCLUDED', suppressed: true }))).toBe('EXCLUDED');
    expect(recordStatusOf(r({ reviewStatus: 'NEEDS_REVIEW', assignedTelecallerUserId: null }))).toBe('NEEDS_REVIEW');
    expect(recordStatusOf(r({ suppressed: true, interactionStatus: 'INTERESTED' }))).toBe('DO_NOT_CONTACT');
    expect(recordStatusOf(r({ assignedTelecallerUserId: null, interactionStatus: 'FOLLOW_UP' }))).toBe('UNASSIGNED');
    expect(recordStatusOf(r({ interactionStatus: 'LINK_SHARED' }))).toBe('LINK_SHARED');
  });

  it('every status has a label and none claims a bank result', () => {
    for (const s of RECORD_STATUSES) expect(RECORD_STATUS_LABELS[s]).toBeTruthy();
    expect(Object.values(RECORD_STATUS_LABELS).join(' ')).not.toMatch(/convert|approved|issued|activated/i);
  });

  it('records query accepts status and a pincode prefix, rejects free text in pincode', () => {
    expect(QueueQuery.parse({ status: 'UNASSIGNED', pincode: '302', pageSize: '100' })).toMatchObject({ status: 'UNASSIGNED', pincode: '302', pageSize: 100 });
    expect(QueueQuery.safeParse({ pincode: 'abc' }).success).toBe(false);
    expect(QueueQuery.safeParse({ status: 'CONVERTED' }).success).toBe(false);
  });
});
