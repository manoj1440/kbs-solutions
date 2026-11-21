import { DATA_REQUEST_STATUS_LABEL, DATA_REQUEST_TYPE_LABEL, type DataRequestAdminView, formatDate, formatDateTime } from '@kbs/shared';
import { ArrowLeft, Gavel, MessageSquareText, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Callout, humanize, KeyValueGrid, PageHeader, SectionCard } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { REQUEST_STATUS_VARIANT } from '../requests-table';

import { RequestActions } from './request-actions';

export const metadata = { title: 'Privacy request' };

/** Erasure is manual (F-904 retention periods are still blocked): staff follow this list and record what they did. */
const ERASURE_STEPS = [
  'Check for open payout requests or entitlements; those must be settled or recorded first.',
  'Deactivate the account on the user page (this ends every session).',
  'Keep payout, tax and audit records as the law requires; nothing is hard-deleted from KBS systems.',
  'Write what was closed and what was kept in the note below, then mark the request completed.',
];

/** F-908: one data-principal request with its requester, the user's words, and the Admin's controls. */
export default async function PrivacyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = (await apiFetch<DataRequestAdminView>(`/privacy/requests/${id}`)).data;
  const closed = d.status === 'COMPLETED' || d.status === 'REJECTED';
  const userHref = d.requester.role === 'ADVISOR' ? `/admin/onboarding/${d.requester.id}` : `/admin/users/${d.requester.id}`;
  return (
    <div className="grid gap-6">
      <Link href="/admin/privacy-requests" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Privacy requests
      </Link>
      <PageHeader
        title={DATA_REQUEST_TYPE_LABEL[d.type]}
        meta={
          <>
            <span className="font-mono">{d.publicRef}</span>
            <Badge variant={REQUEST_STATUS_VARIANT[d.status]}>{DATA_REQUEST_STATUS_LABEL[d.status]}</Badge>
            {d.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
            <span>received {formatDateTime(d.createdAt)}</span>
          </>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <SectionCard icon={MessageSquareText} title="What they asked">
            {d.details ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{d.details}</p> : <p className="text-sm text-muted-foreground">No details given.</p>}
          </SectionCard>
          {d.type === 'ERASURE' && !closed ? (
            <Callout tone="warning" title="Erasure is carried out by hand">
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {ERASURE_STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Callout>
          ) : null}
          {d.type === 'ACCESS' && !closed ? (
            <Callout tone="info">The user can already download their own data from the app or the account page. Reply with a written summary of what KBS holds and who it is shared with.</Callout>
          ) : null}
          <SectionCard icon={Gavel} title={closed ? 'Outcome' : 'Work on this request'}>
            {closed ? (
              <div className="grid gap-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{d.resolutionNote}</p>
                <p className="text-xs text-muted-foreground">
                  {DATA_REQUEST_STATUS_LABEL[d.status]} {formatDateTime(d.closedAt)}
                  {d.handledBy ? ` by ${d.handledBy.fullName}` : ''}. The user sees this reply.
                </p>
                {d.staffNote ? <p className="text-xs text-muted-foreground">Staff note: {d.staffNote}</p> : null}
              </div>
            ) : (
              <RequestActions id={d.id} status={d.status} staffNote={d.staffNote} handledByName={d.handledBy?.fullName ?? null} />
            )}
          </SectionCard>
        </div>
        <SectionCard icon={UserRound} title="Requester">
          <KeyValueGrid
            cols={2}
            items={[
              ['Name', <Link key="n" className="font-medium" href={userHref}>{d.requester.fullName || '(no name yet)'}</Link>],
              ['Role', humanize(d.requester.role)],
              ['KBS reference', <span key="r" className="font-mono">{d.requester.publicRef}</span>],
              ['Mobile', <span key="m" className="font-mono">{d.requester.mobileMasked ?? '—'}</span>],
              ['Account status', humanize(d.requester.status)],
              ['Reply by', formatDate(d.dueAt)],
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}
