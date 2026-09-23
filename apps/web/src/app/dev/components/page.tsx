import { notFound } from 'next/navigation';

import { ActivationBadge, DecisionBadge, FreshnessLabel, PayoutStateBadge, ProvenanceChip, StageBadge } from '@/components/status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PAYOUT_SAMPLES, SAMPLE_AS_OF, STATUS_SAMPLES } from '@/lib/status-samples';

/**
 * F-803 visual QA gallery (no Storybook). Fixture data only. Hidden in production builds unless KBS_DEV_GALLERY=1.
 */
export const dynamic = 'force-dynamic';

export default function ComponentGallery() {
  if (process.env.NODE_ENV === 'production' && process.env.KBS_DEV_GALLERY !== '1') notFound();
  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Status & provenance components</h1>
        <p className="text-muted-foreground text-sm">Every variant with fixture data. Text is always shown; colour only groups (REQ-20 §20.2).</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bank status (Stage · Decision · Activation)</CardTitle>
          <CardDescription>“Awaiting MIS Update” (never matched) and “Not reported” (bank left it blank) are different words, both neutral.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {STATUS_SAMPLES.map((s) => (
            <div key={s.label} className="grid gap-1 border-b pb-3 last:border-b-0 md:grid-cols-[14rem_1fr] md:items-center">
              <span className="text-muted-foreground text-xs">{s.label}</span>
              <div className="flex flex-wrap items-center gap-3">
                <StageBadge field={s.field} />
                <DecisionBadge field={s.field} />
                <ActivationBadge field={s.field} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Provenance & freshness</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <ProvenanceChip provenance="BANK_MIS" asOf={SAMPLE_AS_OF} batchRef="KBS-M-DEMO1" />
          <ProvenanceChip provenance="KBS_OPERATIONAL" asOf={SAMPLE_AS_OF} />
          <ProvenanceChip provenance="KBS_PAYMENT" asOf={SAMPLE_AS_OF} />
          <FreshnessLabel lastMatchedAt={SAMPLE_AS_OF} />
          <FreshnessLabel lastMatchedAt={null} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Payout states</CardTitle>
          <CardDescription>KBS payout ledger — never merged with bank status.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PAYOUT_SAMPLES.map((s) => (
            <PayoutStateBadge key={s} state={s} />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
