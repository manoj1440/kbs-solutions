import { notFound } from 'next/navigation';

import { ActivationBadge, DecisionBadge, FreshnessLabel, PayoutStateBadge, ProvenanceChip, StageBadge } from '@/components/status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeltaBadge, MiniBars, Sparkline } from '@/components/ui/charts';
import { DetailHeader, RailCard, StatCard, StatGrid } from '@/components/ui/kit';
import { TrendChart } from '@/components/ui/trend-chart';
import { PAYOUT_SAMPLES, SAMPLE_AS_OF, STATUS_SAMPLES } from '@/lib/status-samples';

// F-814 fixture series (illustrative numbers only)
const DAYS = Array.from({ length: 14 }, (_, i) => `${i + 4} Oct`);
const LEADS = [4, 6, 5, 9, 7, 12, 10, 8, 14, 11, 16, 13, 9, 15];
const APPROVED = [1, 2, 2, 3, 2, 5, 4, 3, 6, 4, 7, 5, 3, 6];
const ACTIVATED = [0, 1, 1, 1, 2, 2, 3, 1, 3, 2, 4, 3, 2, 3];

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
          <CardTitle>F-814 data visuals</CardTitle>
          <CardDescription>KPI with delta + history, trend chart, ranked bars, rail card, detail header.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <StatGrid>
            <StatCard emphasis label="Leads created" value="15" hint="Today" delta={<DeltaBadge current={15} previous={9} className="bg-white/15 text-white" />} />
            <StatCard label="Bank approved" value="6" hint="Latest MIS" delta={<DeltaBadge current={6} previous={7} />} chart={<Sparkline values={APPROVED} tone="emerald" label="Approved, last 14 days" />} />
            <StatCard label="Cards activated" value="3" delta={<DeltaBadge current={3} previous={3} />} chart={<Sparkline values={ACTIVATED} tone="sky" label="Activated, last 14 days" />} />
            <StatCard label="Payout earned" value="₹1,500" delta={<DeltaBadge current={1500} previous={0} />} />
          </StatGrid>
          <TrendChart
            title="Leads, approvals and activations per day"
            labels={DAYS}
            series={[
              { key: 'leads', label: 'Leads created', tone: 'teal', values: LEADS },
              { key: 'approved', label: 'Bank approved', tone: 'indigo', values: APPROVED },
              { key: 'activated', label: 'Cards activated', tone: 'amber', values: ACTIVATED },
            ]}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <MiniBars items={[{ label: 'Call attempts', value: 120 }, { label: 'Connected', value: 64, tone: 'emerald', hint: '53%' }, { label: 'Interested', value: 21, tone: 'indigo', hint: '18%' }, { label: 'Not answered', value: 40, tone: 'amber' }]} />
            <RailCard
              title="Follow-ups due"
              tone="amber"
              count={2}
              items={[
                { key: '1', href: '#', title: 'Vikram Singh', meta: 'HDFC Millennia · call back', aside: '11:30' },
                { key: '2', href: '#', title: 'Sita Prospect', meta: 'Documents pending', aside: '15:00' },
              ]}
              empty="Nothing due today."
              footer={{ href: '#', label: 'All follow-ups' }}
            />
          </div>
          <DetailHeader back={{ href: '#', label: 'Back to leads' }} title="Vikram Singh" subtitle="HDFC Bank · HDFC Millennia · created 22 Sept 2026" meta={<span>KBS Lead ID KBS-L-BQ3X44RZ</span>} />
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
