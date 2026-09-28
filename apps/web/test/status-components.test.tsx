import { AWAITING_MIS_UPDATE, NOT_REPORTED } from '@kbs/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DecisionBadge, FreshnessLabel, PayoutStateBadge, ProvenanceChip, StageBadge } from '@/components/status';
import { STATUS_SAMPLES } from '@/lib/status-samples';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const neverMatched = STATUS_SAMPLES[0].field;
const blank = STATUS_SAMPLES[1].field;
const inprocess = STATUS_SAMPLES[2].field;

describe('F-803 web status components (VIEW-01, REQ-20 §20.2)', () => {
  it('VIEW-01: "Not reported" and "Awaiting MIS Update" render different text with the same neutral tone', () => {
    const a = html(<StageBadge field={neverMatched} />);
    const b = html(<StageBadge field={blank} />);
    expect(a).toContain(AWAITING_MIS_UPDATE);
    expect(b).toContain(NOT_REPORTED);
    expect(a).not.toContain(NOT_REPORTED);
    for (const out of [a, b]) expect(out).toContain('text-slate-600');
  });
  it('a reported Inprocess decision is labelled and toned differently from "Awaiting MIS Update"', () => {
    const out = html(<DecisionBadge field={inprocess} />);
    expect(out).toContain('Inprocess');
    expect(out).toContain('Decision:');
    expect(out).not.toContain('text-slate-600');
  });
  it('text is always present: provenance, freshness and payout labels', () => {
    expect(html(<ProvenanceChip provenance="BANK_MIS" asOf="2026-09-20T10:30:00.000Z" batchRef="KBS-M-1" />)).toMatch(/Bank MIS.*as of.*KBS-M-1/);
    expect(html(<FreshnessLabel lastMatchedAt={null} />)).toContain('Never matched');
    expect(html(<PayoutStateBadge state="PENDING_APPROVALS" />)).toContain('Pending approvals');
  });
});
