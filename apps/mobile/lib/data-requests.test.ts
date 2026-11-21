import type { PersonalDataExport } from '@kbs/shared';
import { describe, expect, it } from 'vitest';

import { exportSummary, requestError, requestTone } from './data-requests';

describe('F-908 your data', () => {
  it('DPDP-M1 correction and grievance need at least 10 characters; erasure needs none', () => {
    expect(requestError('CORRECTION', 'short')).toMatch(/at least 10/);
    expect(requestError('GRIEVANCE', '   ')).toMatch(/at least 10/);
    expect(requestError('CORRECTION', 'My email address is wrong')).toBeNull();
    expect(requestError('ERASURE', '')).toBeNull();
    expect(requestError('ACCESS', 'x'.repeat(2001))).toMatch(/2000/);
  });
  it('DPDP-M2 every status has a distinct tone', () => {
    expect(new Set((['OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const).map(requestTone)).size).toBe(4);
  });
  it('DPDP-M3 summarises a download in words', () => {
    const x = { leads: [{}], payoutRequests: [], sessions: [{}, {}] } as unknown as PersonalDataExport;
    expect(exportSummary(x)).toBe('1 lead, 0 payout requests, 2 sign-ins');
  });
});
