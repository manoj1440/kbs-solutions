import { formatDateTime } from '@kbs/shared';
import { ArrowRight, BadgeCheck, ClipboardCheck, Hourglass, Landmark, Mail } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, PageHeader, SectionCard, StatCard, StatGrid, type Tone, TONE } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Row {
  userId: string;
  publicRef: string;
  fullName: string;
  email: string | null;
  submittedAt: string | null;
  identityStatus: string;
  bankName: string | null;
  accountLast4: string | null;
}

const HOUR = 3_600_000;
/** Waiting time since submission, with a tone that escalates after a day and after three. */
function waiting(submittedAt: string | null, now: number): { label: string; tone: Tone; hours: number } | null {
  if (!submittedAt) return null;
  const hours = Math.max(0, (now - new Date(submittedAt).getTime()) / HOUR);
  const label = hours < 1 ? 'under an hour' : hours < 48 ? `${Math.floor(hours)} h` : `${Math.floor(hours / 24)} days`;
  return { label, hours, tone: hours >= 72 ? 'rose' : hours >= 24 ? 'amber' : 'emerald' };
}

/** F-401 §8: Advisor onboarding review queue. */
export default async function OnboardingQueuePage() {
  const q = await apiFetch<Row[]>('/onboarding/review');
  const now = new Date().getTime();
  const rows = q.data.map((r) => ({ ...r, wait: waiting(r.submittedAt, now) }));
  const verified = q.data.filter((r) => r.identityStatus === 'VERIFIED').length;
  const oldest = rows.reduce<(typeof rows)[number]['wait']>((a, r) => (r.wait && (!a || r.wait.hours > a.hours) ? r.wait : a), null);
  const overDay = rows.filter((r) => r.wait && r.wait.hours >= 24).length;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={ClipboardCheck}
        tone="violet"
        eyebrow="People"
        title="Advisor onboarding review"
        description="Identity shows the provider result only; bank details are masked and every reveal is logged."
      >
        <StatGrid>
          <StatCard label="Awaiting review" value={q.data.length} hint="Submitted Advisors, oldest first below" icon={ClipboardCheck} emphasis />
          <StatCard label="Identity verified" value={verified} hint={`of ${q.data.length} in the queue`} icon={BadgeCheck} tone="emerald" />
          <StatCard label="Waiting over a day" value={overDay} hint="Since the Advisor submitted" icon={Hourglass} tone={overDay ? 'amber' : 'slate'} />
          <StatCard label="Longest wait" value={oldest ? oldest.label : '—'} hint="Oldest submission in the queue" icon={Hourglass} tone={oldest?.tone === 'rose' ? 'rose' : 'slate'} />
        </StatGrid>
      </PageHeader>
      <SectionCard icon={ClipboardCheck} tone="violet" title="Awaiting review" description={`${q.data.length} submissions.`}>
        {q.data.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nothing awaiting review." description="New Advisor submissions appear here as soon as they are sent for review." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {[...rows]
              .sort((a, b) => (b.wait?.hours ?? -1) - (a.wait?.hours ?? -1))
              .map((r) => (
                <li
                  key={r.userId}
                  className="lift relative grid min-w-0 gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/4%)]"
                >
                  <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', r.wait ? TONE[r.wait.tone].bar : 'bg-slate-200')} />
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={r.fullName || r.publicRef} />
                    <div className="min-w-0 flex-1">
                      <Link className="font-semibold break-words text-slate-900 hover:text-teal-700" href={`/admin/onboarding/${r.userId}`}>
                        {r.fullName || '(no name)'}
                      </Link>
                      <div className="font-mono text-[11px] text-slate-500">{r.publicRef}</div>
                      {r.email ? (
                        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-slate-500">
                          <Mail className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{r.email}</span>
                        </div>
                      ) : null}
                    </div>
                    {r.wait ? (
                      <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', TONE[r.wait.tone].tile)}>
                        <Hourglass className="size-3" aria-hidden="true" />
                        {r.wait.label}
                      </span>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50/80 p-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[10.5px] font-medium tracking-wide text-slate-500 uppercase">Identity</dt>
                      <dd className="mt-1">
                        <Badge variant={r.identityStatus === 'VERIFIED' ? 'success' : 'warning'}>{humanize(r.identityStatus)}</Badge>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10.5px] font-medium tracking-wide text-slate-500 uppercase">Bank</dt>
                      <dd className="mt-1 flex min-w-0 items-center gap-1 text-slate-800">
                        <Landmark className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">
                          {r.bankName} ••••{r.accountLast4}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11.5px] text-slate-500 tabular-nums">Submitted {r.submittedAt ? formatDateTime(r.submittedAt) : '—'}</span>
                    <Button asChild size="sm" variant="soft">
                      <Link href={`/admin/onboarding/${r.userId}`} aria-hidden="true" tabIndex={-1}>
                        Review
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
