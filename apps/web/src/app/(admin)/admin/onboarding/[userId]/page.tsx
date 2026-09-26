import { formatDateTime, ONBOARDING_STEPS, type OnboardingView } from '@kbs/shared';
import { ArrowLeft, Check, Fingerprint, Gavel, Landmark, MessageSquareText } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Avatar, Callout, humanize, KeyValueGrid, PageHeader, SectionCard } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { ReviewActions } from './review-actions';

type Detail = OnboardingView & { userId: string; profileId: string; bankAccountNumber: string | null };

export default async function OnboardingReviewPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const d = (await apiFetch<Detail>(`/onboarding/review/${userId}`)).data;
  const canDecide = d.step === 'AWAITING_REVIEW';
  const at = ONBOARDING_STEPS.indexOf(d.step);
  return (
    <div className="grid gap-6">
      <Link href="/admin/onboarding" className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Advisor approvals
      </Link>

      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgb(139_92_246/10%),transparent_65%)]" />
        <div className="relative grid gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={d.personal.fullName || userId} size="lg" className="shadow-sm ring-4 ring-white" />
            <PageHeader
              eyebrow="Workspace · Advisor approvals"
              tone="violet"
              title={d.personal.fullName || '(no name)'}
              meta={
                <>
                  <Badge variant={d.step === 'AWAITING_REVIEW' ? 'info' : d.step === 'COMPLETE' ? 'success' : 'warning'}>{humanize(d.step)}</Badge>
                  {d.submittedAt ? <span className="text-sm text-slate-500">submitted {formatDateTime(d.submittedAt)}</span> : null}
                </>
              }
            />
          </div>
          {at >= 0 ? (
            <ol aria-label="Onboarding steps" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
              {ONBOARDING_STEPS.map((s, i) => {
                const done = i < at || d.step === 'COMPLETE';
                const current = i === at && d.step !== 'COMPLETE';
                return (
                  <li key={s} aria-current={current ? 'step' : undefined} className="flex min-w-[5.5rem] flex-1 flex-col gap-1.5">
                    <span className={cn('h-1.5 rounded-full', done ? 'bg-teal-600' : current ? 'bg-violet-500' : 'bg-slate-200')} />
                    <span className={cn('flex items-center gap-1 text-[11px] leading-tight font-medium', done ? 'text-teal-800' : current ? 'text-violet-700' : 'text-slate-400')}>
                      {done ? <Check className="size-3 shrink-0" aria-hidden="true" /> : null}
                      {humanize(s)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <SectionCard icon={Fingerprint} tone="indigo" title="Identity" description="Provider result only — KBS holds no identity number or document.">
            <div className="grid gap-4 text-sm">
              <KeyValueGrid
                cols={2}
                items={[
                  ['Status', <Badge key="s" variant={d.identity.status === 'VERIFIED' ? 'success' : 'destructive'}>{humanize(d.identity.status)}</Badge>],
                  ['Provider', d.identity.provider ?? '—'],
                  ['Method', d.identity.method ?? '—'],
                  ['Verified', d.identity.verifiedAt ? formatDateTime(d.identity.verifiedAt) : '—'],
                ]}
              />
              {d.identity.summary ? <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200 ring-inset">{JSON.stringify(d.identity.summary, null, 2)}</pre> : null}
              {d.consent ? (
                <p className="text-xs text-slate-500">
                  Consent recorded {formatDateTime(d.consent.at)} · privacy notice {d.consent.privacyNoticeVersion}
                </p>
              ) : null}
            </div>
          </SectionCard>
          <SectionCard icon={Landmark} tone="teal" title="Contact, bank & cheque" description="Account number masked; reveal is logged as a sensitive access.">
            <div className="grid gap-5">
              <KeyValueGrid
                cols={3}
                items={[
                  ['Email', d.personal.email ?? '—'],
                  ['Bank', d.bank?.bankName ?? '—'],
                  ['Account holder', d.bank?.accountHolderName ?? '—'],
                  ['Account', <span key="a" className="font-mono">••••{d.bank?.accountLast4 ?? '—'}</span>],
                  ['IFSC', <span key="i" className="font-mono">{d.bank?.ifsc ?? '—'}</span>],
                  [
                    'Reporting to',
                    d.reportingParent ? (
                      <span key="r" className="inline-flex items-center gap-2">
                        <Avatar name={d.reportingParent.fullName} size="sm" className="size-6 text-[9px]" />
                        {`${d.reportingParent.fullName} (${humanize(d.reportingParent.role)})`}
                      </span>
                    ) : (
                      '—'
                    ),
                  ],
                ]}
              />
              <div className="border-t border-slate-100 pt-4">
                <ReviewActions part="evidence" userId={userId} chequeFileId={d.cheque?.fileId ?? null} chequeName={d.cheque?.originalName ?? null} canDecide={canDecide} />
              </div>
            </div>
          </SectionCard>
        </div>
        <SectionCard
          icon={Gavel}
          tone={canDecide ? 'amber' : 'slate'}
          title="Decision"
          description={canDecide ? 'Approve to activate the Advisor, or send it back with a reason.' : `Nothing to decide at step “${humanize(d.step)}”.`}
          className={cn('lg:sticky lg:top-24', canDecide && 'order-first ring-2 ring-amber-200 lg:order-none')}
        >
          <div className="grid gap-3">
            {d.review ? (
              <Callout tone={d.review.outcome === 'APPROVED' ? 'success' : 'neutral'} icon={MessageSquareText} title={`Last review: ${humanize(d.review.outcome)}`}>
                {d.review.reason ? <span className="break-words">{d.review.reason} · </span> : null}
                {formatDateTime(d.review.at)}
              </Callout>
            ) : null}
            <ReviewActions part="decision" userId={userId} chequeFileId={d.cheque?.fileId ?? null} chequeName={d.cheque?.originalName ?? null} canDecide={canDecide} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
