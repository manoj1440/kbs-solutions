import { formatDateTime } from '@kbs/shared';
import { ArrowRight, ClipboardCheck, Hourglass, Landmark, Mail } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, MiniStat, type Tone, TONE } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Advisor onboarding · KBS Solutions' };

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

/** F-401 §8 → F-811: Advisor onboarding review queue, compact. */
export default async function OnboardingQueuePage() {
  const q = await apiFetch<Row[]>('/onboarding/review');
  const now = new Date().getTime();
  const rows = q.data.map((r) => ({ ...r, wait: waiting(r.submittedAt, now) }));
  const verified = q.data.filter((r) => r.identityStatus === 'VERIFIED').length;
  const oldest = rows.reduce<(typeof rows)[number]['wait']>((a, r) => (r.wait && (!a || r.wait.hours > a.hours) ? r.wait : a), null);
  const overDay = rows.filter((r) => r.wait && r.wait.hours >= 24).length;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Advisor onboarding review</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Awaiting review" value={q.data.length} hint="Oldest first below" tone="sky" />
        <MiniStat label="Identity verified" value={verified} hint={`of ${q.data.length} in the queue`} tone="emerald" />
        <MiniStat label="Waiting over a day" value={overDay} hint="Since submission" tone={overDay ? 'amber' : 'slate'} />
        <MiniStat label="Longest wait" value={oldest ? oldest.label : '—'} hint="Oldest submission" tone={oldest?.tone === 'rose' ? 'rose' : 'slate'} />
      </div>
      <section aria-label="Awaiting review" className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        {q.data.length === 0 ? (
          <EmptyState icon={ClipboardCheck} className="m-3" title="Nothing awaiting review." description="New Advisor submissions appear here as soon as they are sent for review." />
        ) : (
          <ul className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
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
      </section>
    </div>
  );
}
