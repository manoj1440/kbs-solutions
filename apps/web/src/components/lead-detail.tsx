import { formatDateTime, formatInr, type LeadStatusRow, type MisHistoryGroup, type OperationalEvent } from '@kbs/shared';
import { FileClock, Hash, Landmark, MessageSquareText, UserRound, Wallet } from 'lucide-react';

import { CreditCardArt } from '@/components/card-art';
import type { EntitlementDto } from '@/components/entitlements-table';
import { LeadHistoryTable } from '@/components/lead-history-table';
import { type FollowUpDto, LeadOps, type RemarkDto } from '@/components/lead-ops';
import { ActivationBadge, DecisionBadge, FreshnessLabel, PayoutStateBadge, ProvenanceChip, StageBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Avatar, DetailHeader, EmptyState, humanize, IconTile, KeyValueGrid, SectionCard } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

interface RemarkField {
  field: string;
  label: string;
  raw: string | null;
  display: string;
}
export interface LeadDetailDto extends Omit<LeadStatusRow, 'bankReference'> {
  customerPanMasked: string | null;
  panVerificationStatus: string;
  pincode: string;
  city: string | null;
  state: string | null;
  employmentType: string;
  annualIncomeItr: number;
  operationalEvents: OperationalEvent[];
  followUps: FollowUpDto[];
  remarks: RemarkDto[];
  bankStatus: { matched: boolean; provenance: string; lastMatchedAt: string | null; lastMatchedBatchRef: string | null; firstMatchedAt: string | null; finalDecisionDate: string | null; raw: Record<string, string> | null };
  bankRemarks: { remarks: RemarkField[]; kyc: RemarkField[] };
  bankReference: { value: string | null; kind?: string; status?: string; source?: string; label?: string; at?: string };
  referenceHistory: { id: string; kind: string; value: string; status: string; source: string; at: string; supersededAt: string | null }[];
}

/**
 * F-408 — lead detail (REQ-11 §11.9): (A) customer + KBS activity, (B) bank references + latest raw snapshot,
 * (C) grouped bank remarks and Bank/KYC information, bank status history grouped by upload (REQ-14 §14.6), (D) payout.
 * No timeline. F-814: DetailHeader + bank-status hero; bank fields left, people/KBS activity right, then bank status history
 * and payout full width; fields the bank left blank collapse behind a count (one click away, never dropped).
 */
export async function LeadDetail({ id, backHref }: { id: string; backHref: string }) {
  const [d, h, ents] = await Promise.all([apiFetch<LeadDetailDto>(`/leads/${id}`), apiFetch<MisHistoryGroup[]>(`/leads/${id}/mis-history`), apiFetch<EntitlementDto[]>(`/payouts/entitlements?leadId=${id}`)]);
  const l = d.data;
  const bankCode = l.bank.code;
  const earlier = l.referenceHistory.filter((r) => r.supersededAt);
  const raw = Object.entries(l.bankStatus.raw ?? {});
  return (
    <div className="grid gap-6">
      <DetailHeader
        back={{ href: backHref, label: 'Back to leads' }}
        visual={<Avatar name={l.customer.name} size="lg" className="size-11 text-base sm:size-14 sm:text-lg" />}
        title={<span className="break-words">{l.customer.name}</span>}
        subtitle={
          <>
            {l.bank.displayName} · {l.card.name}
            {l.card.crosswalked && l.card.crosswalked.id !== l.card.id ? ` (bank product ${l.card.crosswalked.productCode} → ${l.card.crosswalked.name})` : ''} · created {formatDateTime(l.leadCreatedAt)}
          </>
        }
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-fg-2">
            <Hash className="size-3.5 text-fg-3" aria-hidden="true" />
            KBS Lead ID <code className="font-mono font-semibold text-foreground">{l.kbsRef}</code>
          </span>
        }
      >
        <section
          aria-labelledby="bank-status-title"
          className="grid gap-5 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]"
        >
          <div className="grid content-start gap-3">
            <CreditCardArt bankCode={bankCode} bankName={l.bank.displayName} cardName={l.card.name} className="max-w-[260px]" />
            <p className="text-2xs leading-relaxed text-muted-foreground">Illustration only — not the bank&apos;s card artwork.</p>
          </div>
          <div className="grid min-w-0 content-start gap-4">
            <div className="flex items-start gap-3">
              <IconTile icon={Landmark} tone="indigo" size="sm" />
              <div className="min-w-0">
                <h2 id="bank-status-title" className="text-[15px] leading-6 font-semibold tracking-tight text-foreground">
                  Bank status
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Three independent bank-reported fields. Nothing here is inferred from KBS activity.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[<StageBadge key="s" field={l.stage} />, <DecisionBadge key="d" field={l.decision} />, <ActivationBadge key="a" field={l.activation} />].map((badge) => (
                <div key={badge.key} className="flex min-w-0 items-center rounded-xl border border-border bg-surface-muted px-3 py-3 [&_[data-slot=badge]]:whitespace-normal [&>span]:flex-wrap">
                  {badge}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
              <span className="max-w-full [&>span]:flex-wrap [&>span]:rounded-lg">
                <ProvenanceChip provenance="BANK_MIS" asOf={l.lastMatchedAt} batchRef={l.bankStatus.lastMatchedBatchRef} />
              </span>
              <FreshnessLabel lastMatchedAt={l.lastMatchedAt} />
              {l.bankStatus.finalDecisionDate ? <span className="text-xs text-muted-foreground">Bank decision date {formatDateTime(l.bankStatus.finalDecisionDate)}</span> : null}
            </div>
          </div>
        </section>
      </DetailHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid min-w-0 content-start gap-6">
          <SectionCard icon={Landmark} tone="indigo" title="Bank references & latest snapshot" description="Exact values from the latest bank update for this lead." bodyClassName="grid gap-4 text-sm">
            <div className="rounded-xl border border-border bg-surface-muted p-3.5">
              <p className="text-2xs font-medium text-muted-foreground">Reference</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {l.bankReference.value ? (
                  <>
                    <code className="text-ui font-semibold text-foreground">{l.bankReference.value}</code> <span className="text-xs text-muted-foreground">({l.bankReference.kind})</span>{' '}
                    <Badge variant={l.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'success' : 'warning'}>{l.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'Verified by the bank' : 'Unverified'}</Badge>
                  </>
                ) : (
                  <span className="text-muted-foreground">{l.bankReference.label}</span>
                )}
              </div>
              {earlier.length ? <p className="mt-2 text-xs text-muted-foreground">Earlier: {earlier.map((r) => `${r.value} (${formatDateTime(r.at)})`).join(' · ')}</p> : null}
            </div>
            {l.bankStatus.raw ? (
              <FieldList
                title="Bank column"
                aside={`Value as received · ${raw.length} fields`}
                fields={raw.map(([k, v]) => ({ key: k, label: k, value: v, blank: v === '' }))}
                mono
                blankWord="blank"
              />
            ) : (
              <EmptyState icon={FileClock} title="No bank update for this lead yet." />
            )}
          </SectionCard>

          <SectionCard icon={MessageSquareText} tone="indigo" title="Bank reason / remarks and Bank/KYC information" description="Named bank fields, verbatim. Not editable through operational notes." bodyClassName="grid gap-4 text-sm md:grid-cols-2">
            {(
              [
                ['Bank reason / remarks', l.bankRemarks.remarks],
                ['Bank/KYC information', l.bankRemarks.kyc],
              ] as const
            ).map(([label, fields]) => (
              <FieldList key={label} title={label} fields={fields.map((f) => ({ key: f.field, label: f.label, value: f.display, blank: f.raw === null }))} blankWord="not reported" />
            ))}
          </SectionCard>

        </div>

        <div className="grid min-w-0 content-start gap-6">
          <SectionCard icon={UserRound} tone="violet" title="Customer & KBS activity" description="Operational events are labelled KBS activity and never stand in for a bank stage." bodyClassName="grid gap-5">
            <KeyValueGrid
              items={[
                ['Mobile', <span key="m" className="tabular-nums">{l.customer.mobileMasked ?? '—'}</span>],
                [
                  'PAN',
                  <span key="p">
                    <span className="font-mono">{l.customerPanMasked ?? '—'}</span> <span className="text-xs text-muted-foreground">({l.panVerificationStatus.toLowerCase()})</span>
                  </span>,
                ],
                [
                  'Location',
                  <span key="l">
                    {l.pincode} · {l.city ?? '—'}, {l.state ?? '—'}
                  </span>,
                ],
                [
                  'Employment',
                  <span key="e">
                    {humanize(l.employmentType)} · ₹{l.annualIncomeItr.toLocaleString('en-IN')} p.a.
                  </span>,
                ],
              ]}
            />
            {l.operationalEvents.length ? (
              <ol className="grid gap-0 border-t border-border-subtle pt-4">
                {l.operationalEvents.map((e) => (
                  <li key={e.id} className="relative grid gap-1 pb-4 pl-6 last:pb-0 before:absolute before:top-2 before:bottom-0 before:left-[5px] before:w-px before:bg-border last:before:hidden">
                    <span className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-card bg-sky-500 ring-1 ring-sky-200" aria-hidden="true" />
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{e.label}</span>
                      <ProvenanceChip provenance="KBS_OPERATIONAL" />
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatDateTime(e.at)}</span>
                      {e.detail ? <span>{e.detail}</span> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </SectionCard>

          <LeadOps leadId={l.id} followUps={l.followUps} remarks={l.remarks} />
        </div>
      </div>

      <SectionCard
        icon={FileClock}
        tone="sky"
        title="Bank status history"
        description="Each bank update: old → new value as the bank wrote it, the bank's event date and when it was uploaded."
        bodyClassName="grid gap-5"
      >
        {h.data.length === 0 ? (
          <EmptyState icon={FileClock} title="No bank update for this lead yet." />
        ) : (
          h.data.map((g) => {
            const changed = g.changes.filter((c) => c.changeKind === 'SET' || c.changeKind === 'CHANGED' || c.changeKind === 'ABSENT_FROM_BATCH');
            const quiet = g.changes.filter((c) => !changed.includes(c));
            return (
              <div key={g.batchId} className="grid gap-2.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                  <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 font-mono text-xs text-sky-800 ring-1 ring-sky-100 ring-inset">{g.publicRef}</span>
                  <span className="font-normal text-muted-foreground">
                    · imported {formatDateTime(g.importedAt)} by {g.uploaderRole.toLowerCase()}
                  </span>
                </p>
                {changed.length === 0 ? <p className="text-sm text-muted-foreground">Identical repeat — no bank value changed in this batch.</p> : <LeadHistoryTable batchId={g.batchId} changes={changed} />}
                {quiet.length ? (
                  <details className="group text-xs">
                    <summary className="cursor-pointer py-1 text-muted-foreground">
                      {quiet.filter((c) => c.changeKind === 'CONFIRMED_SAME').length} field(s) confirmed unchanged · {quiet.filter((c) => c.changeKind === 'REPORTED_BLANK').length} reported blank
                    </summary>
                    <div className="mt-2">
                      <LeadHistoryTable batchId={g.batchId} changes={quiet} />
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })
        )}
      </SectionCard>

      <SectionCard icon={Wallet} tone="teal" title="Payout" description="A payout is earned once the bank reports the value an approved payout rule asks for.">
        {ents.data.length === 0 ? (
          <EmptyState icon={Wallet} title="No payout entitlement for this lead." />
        ) : (
          <ul className="grid gap-2 text-sm">
            {ents.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border px-4 py-3">
                <PayoutStateBadge state={e.state} />
                <span className="text-base font-semibold tabular-nums">{formatInr(e.amountInr)}</span>
                <span className="min-w-0 text-xs text-muted-foreground">
                  <code>{e.triggerField}</code> = “{e.triggerFieldValue}” · {e.rule.name} v{e.rule.version} · eligible {formatDateTime(e.eligibleAt)} · evidence {e.evidence.batchRef}
                </span>
                {e.reviewReason ? <span className="text-xs">{e.reviewReason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

/** Label/value list where fields the bank left blank collapse behind a count (REQ-20.4 "Not reported", never dropped). */
function FieldList({ title, aside, fields, mono, blankWord }: { title: string; aside?: string; fields: { key: string; label: string; value: string; blank: boolean }[]; mono?: boolean; blankWord: string }) {
  const reported = fields.filter((f) => !f.blank);
  const blank = fields.filter((f) => f.blank);
  const row = (f: (typeof fields)[number]) => (
    <div key={f.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-b border-border-subtle px-3 py-2 last:border-0">
      <dt className={mono ? 'font-mono text-2xs break-all text-muted-foreground' : 'text-muted-foreground'}>{f.label}</dt>
      <dd className={f.blank ? 'text-fg-3 italic' : 'break-words text-foreground'}>{f.blank ? (f.value || blankWord) : f.value}</dd>
    </div>
  );
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border">
      <p className="flex items-center justify-between gap-2 border-b border-border-subtle bg-surface-muted px-3 py-2 text-ui font-medium text-foreground">
        <span>{title}</span>
        {aside ? <span className="text-2xs font-normal text-muted-foreground">{aside}</span> : null}
      </p>
      <dl className="text-xs">
        {reported.map(row)}
        {reported.length === 0 ? <p className="px-3 py-2 text-muted-foreground">Nothing reported by the bank.</p> : null}
      </dl>
      {blank.length ? (
        <details className="group border-t border-border-subtle text-xs">
          <summary className="cursor-pointer px-3 py-2 text-muted-foreground hover:text-foreground">
            {blank.length} field{blank.length === 1 ? '' : 's'} {blankWord}
          </summary>
          <dl className="border-t border-border-subtle">{blank.map(row)}</dl>
        </details>
      ) : null}
    </div>
  );
}
