import { describe, expect, it } from 'vitest';

import { COMPANY, type CompanyFacts, LEGAL_FALLBACK } from '../src/legal/company';
import { buildPrivacyNotice, PRIVACY_NOTICE } from '../src/legal/privacy-notice';

const filled: CompanyFacts = {
  legalName: 'Example Pvt Ltd',
  entityType: 'Private limited company',
  registrationNumber: 'U00000XX0000PTC000000',
  gstin: '00AAAAA0000A0Z0',
  registeredAddress: '1 Example Road, City',
  privacyEmail: 'privacy@example.invalid',
  grievanceOfficer: { name: 'A Person', designation: 'Grievance Officer', email: 'go@example.invalid', phone: '+91 00000 00000', hours: 'Mon–Fri' },
  dataStorageRegion: 'India (Mumbai)',
};

const allText = (n: ReturnType<typeof buildPrivacyNotice>) => n.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.items ?? [])]);

describe('F-908 privacy notice (DPDP Act 2023 s.5)', () => {
  it('every section has an id, a heading and at least one paragraph', () => {
    expect(PRIVACY_NOTICE.sections.length).toBeGreaterThan(10);
    for (const s of PRIVACY_NOTICE.sections) {
      expect(s.id).toMatch(/^[a-z-]+$/);
      expect(s.heading.trim()).not.toBe('');
      expect(s.paragraphs.length).toBeGreaterThan(0);
      for (const p of s.paragraphs) expect(p.trim()).not.toBe('');
    }
  });

  it('section ids are unique and the stable ones exist', () => {
    const ids = PRIVACY_NOTICE.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['who-we-are', 'what-we-collect', 'why', 'legal-basis', 'sharing', 'storage', 'retention', 'your-rights', 'grievance-officer', 'board', 'children', 'cookies', 'security', 'changes']) expect(ids).toContain(id);
  });

  it('leaves no unresolved placeholder in any paragraph or item', () => {
    for (const t of allText(PRIVACY_NOTICE)) {
      expect(t).not.toMatch(/[{}]/);
      expect(t).not.toMatch(/undefined|null/);
    }
  });

  it('shows the fallback for unknown company facts and the real value once filled', () => {
    if (!COMPANY.legalName) expect(allText(PRIVACY_NOTICE).join('\n')).toContain(LEGAL_FALLBACK);
    const n = buildPrivacyNotice(filled);
    const text = allText(n).join('\n');
    expect(text).toContain('Example Pvt Ltd');
    expect(text).toContain('go@example.invalid');
    expect(text).toContain('India (Mumbai)');
    for (const t of allText(n)) expect(t).not.toMatch(/[{}]/);
  });

  it('carries a version and an ISO date', () => {
    expect(PRIVACY_NOTICE.version).toMatch(/^v\d/);
    expect(PRIVACY_NOTICE.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
