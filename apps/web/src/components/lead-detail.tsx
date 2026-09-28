import { formatDateTime, formatInr, type LeadStatusRow, type MisHistoryGroup, type OperationalEvent } from '@kbs/shared';
import { ArrowLeft, FileClock, Hash, Landmark, MessageSquareText, UserRound, Wallet } from 'lucide-react';
import Link from 'next/link';

import { CreditCardArt } from '@/components/card-art';
import type { EntitlementDto } from '@/components/entitlements-table';
import { LeadHistoryTable } from '@/components/lead-history-table';
import { type FollowUpDto, LeadOps, type RemarkDto } from '@/components/lead-ops';
import { ActivationBadge, DecisionBadge, FreshnessLabel, PayoutStateBadge, ProvenanceChip, StageBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, IconTile, KeyValueGrid, PageHeader, SectionCard } from '@/components/ui/kit';
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
 * F-408 — lead detail sections (REQ-11 §11.9): A operational (KBS activity), B bank references + latest raw snapshot,
 * C grouped bank remarks and Bank/KYC information, MIS change history grouped by batch (REQ-14 §14.6). No timeline.
 * F-806: summary hero (customer, bank card, the three bank badges + provenance) above the lettered sections.
 */
export async function LeadDetail({ id, backHref, eyebrow = 'Workspace' }: { id: string; backHref: string; eyebrow?: string }) {
  const [d, h, ents] = await Promise.all([apiFetch<LeadDetailDto>(`/leads/${id}`), apiFetch<MisHistoryGroup[]>(`/leads/${id}/mis-history`), apiFetch<EntitlementDto[]>(`/payouts/entitlements?leadId=${id}`)]);
  const l = d.data;
  const bankCode = l.bank.code;
  const earlier = l.referenceHistory.filter((r) => r.supersededAt);
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={eyebrow}
        title={
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={l.customer.name} size="lg" className="size-11 text-base sm:size-14 sm:text-lg" />
            <span className="min-w-0 break-words">{l.customer.name}</span>
          </span>
        }
        description={
          <>
            {l.bank.displayName} · {l.card.name}
            {l.card.crosswalked && l.card.crosswalked.id !== l.card.id ? ` (bank product ${l.card.crosswalked.productCode} → ${l.card.crosswalked.name})` : ''} · created {formatDateTime(l.leadCreatedAt)}
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600">
              <Hash className="size-3.5 text-slate-400" aria-hidden="true" />
              KBS Lead ID <code className="font-semibold text-slate-800">{l.kbsRef}</code>
            </span>
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft />
              Back to leads
            </Link>
          </Button>
        }
      >
        <section
          aria-labelledby="bank-status-title"
          className="grid gap-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)] sm:p-6 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]"
        >
          <div className="grid content-start gap-3">
            <CreditCardArt bankCode={bankCode} bankName={l.bank.displayName} cardName={l.card.name} className="max-w-[260px]" />
            <p className="text-[11px] leading-relaxed text-slate-500">Illustration only — not the bank&apos;s card artwork.</p>
          </div>
          <div className="grid min-w-0 content-start gap-4">
            <div className="flex items-start gap-3">
              <IconTile icon={Landmark} tone="indigo" size="sm" />
              <div className="min-w-0">
                <h2 id="bank-status-title" className="text-[15px] leading-6 font-semibold tracking-tight text-slate-900">
                  Bank status (from MIS only)
                </h2>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">Three independent bank-reported fields. Nothing here is inferred from KBS activity.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[<StageBadge key="s" field={l.stage} />, <DecisionBadge key="d" field={l.decision} />, <ActivationBadge key="a" field={l.activation} />].map((badge) => (
                <div key={badge.key} className="flex min-w-0 items-center rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-3 [&_[data-slot=badge]]:whitespace-normal [&>span]:flex-wrap">
                  {badge}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <span className="max-w-full [&>span]:flex-wrap [&>span]:rounded-lg">
                <ProvenanceChip provenance="BANK_MIS" asOf={l.lastMatchedAt} batchRef={l.bankStatus.lastMatchedBatchRef} />
              </span>
              <FreshnessLabel lastMatchedAt={l.lastMatchedAt} />
              {l.bankStatus.finalDecisionDate ? <span className="text-muted-foreground text-xs">Bank decision date {formatDateTime(l.bankStatus.finalDecisionDate)}</span> : null}
            </div>
          </div>
        </section>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={UserRound} tone="violet" title="A · Customer & KBS activity" description="Operational events are labelled KBS activity and never stand in for a bank stage." bodyClassName="grid gap-5">
          <KeyValueGrid
            items={[
              ['Mobile', <span key="m" className="tabular-nums">{l.customer.mobileMasked ?? '—'}</span>],
              [
                'PAN',
                <span key="p">
                  <span className="font-mono">{l.customerPanMasked ?? '—'}</span> <span className="text-xs text-slate-500">({l.panVerificationStatus.toLowerCase()})</span>
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
            <ol className="grid gap-0 border-t border-slate-100 pt-4">
              {l.operationalEvents.map((e) => (
                <li key={e.id} className="relative grid gap-1 pb-4 pl-6 last:pb-0 before:absolute before:top-2 before:bottom-0 before:left-[5px] before:w-px before:bg-slate-200 last:before:hidden">
                  <span className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-white bg-sky-500 ring-1 ring-sky-200" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-slate-800">{e.label}</span>
                    <ProvenanceChip provenance="KBS_OPERATIONAL" />
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                    <span className="tabular-nums">{formatDateTime(e.at)}</span>
                    {e.detail ? <span>{e.detail}</span> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </SectionCard>

        <SectionCard icon={Landmark} tone="indigo" title="B · Bank references & latest snapshot" description="Exact values from the newest accepted MIS row for this lead." bodyClassName="grid gap-4 text-sm">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Reference</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {l.bankReference.value ? (
                <>
                  <code className="text-[13px] font-semibold text-slate-900">{l.bankReference.value}</code> <span className="text-muted-foreground text-xs">({l.bankReference.kind})</span>{' '}
                  <Badge variant={l.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'success' : 'warning'}>{l.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'Verified by MIS match' : 'Unverified'}</Badge>
                </>
              ) : (
                <span className="text-muted-foreground">{l.bankReference.label}</span>
              )}
            </div>
            {earlier.length ? <p className="text-muted-foreground mt-2 text-xs">Earlier: {earlier.map((r) => `${r.value} (${formatDateTime(r.at)})`).join(' · ')}</p> : null}
          </div>
          {l.bankStatus.raw ? (
            <div className="overflow-hidden rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10.5px] font-semibold tracking-wider text-slate-500 uppercase">
                <span>Bank column</span>
                <span>Value as received · {Object.keys(l.bankStatus.raw).length} fields</span>
              </div>
              <dl className="max-h-80 overflow-auto text-xs">
                {Object.entries(l.bankStatus.raw).map(([k, v]) => (
                  <Field key={k} k={k} v={v} mono />
                ))}
              </dl>
            </div>
          ) : (
            <EmptyState icon={FileClock} title="No MIS row has matched this lead yet." />
          )}
        </SectionCard>
      </div>

      <LeadOps leadId={l.id} followUps={l.followUps} remarks={l.remarks} />

      <SectionCard icon={MessageSquareText} tone="indigo" title="C · Bank reason / remarks and Bank/KYC information" description="Named bank fields, verbatim. Not editable through operational notes." bodyClassName="grid gap-4 text-sm md:grid-cols-2">
        {(
          [
            ['Bank reason / remarks', l.bankRemarks.remarks],
            ['Bank/KYC information', l.bankRemarks.kyc],
          ] as const
        ).map(([label, fields]) => (
          <div key={label} className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80">
            <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-800">{label}</p>
            <dl className="text-xs">
              {fields.map((f) => (
                <Field key={f.field} k={f.label} v={f.display} muted={f.raw === null} />
              ))}
            </dl>
          </div>
        ))}
      </SectionCard>

      <SectionCard
        icon={FileClock}
        tone="sky"
        title="MIS update history"
        description="Grouped by imported batch: exact old → new bank value, reported bank event date, KBS import time and uploader role. Identical repeats show as confirmed unchanged."
        bodyClassName="grid gap-5"
      >
        {h.data.length === 0 ? (
          <EmptyState icon={FileClock} title="No MIS batch has matched this lead yet." />
        ) : (
          h.data.map((g) => {
            const changed = g.changes.filter((c) => c.changeKind === 'SET' || c.changeKind === 'CHANGED' || c.changeKind === 'ABSENT_FROM_BATCH');
            const quiet = g.changes.filter((c) => !changed.includes(c));
            return (
              <div key={g.batchId} className="grid gap-2.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-800">
                  <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 font-mono text-xs text-sky-800 ring-1 ring-sky-100 ring-inset">{g.publicRef}</span>
                  <span className="font-normal text-slate-500">
                    · imported {formatDateTime(g.importedAt)} by {g.uploaderRole.toLowerCase()}
                  </span>
                </p>
                {changed.length === 0 ? <p className="text-muted-foreground text-sm">Identical repeat — no bank value changed in this batch.</p> : <LeadHistoryTable batchId={g.batchId} changes={changed} />}
                {quiet.length ? (
                  <details className="group text-xs">
                    <summary className="text-muted-foreground cursor-pointer py-1">
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

      <SectionCard icon={Wallet} tone="teal" title="D · Payout" description="Entitlements exist only when the bank MIS evidences an approved rule’s exact trigger value. Activation alone implies nothing.">
        {ents.data.length === 0 ? (
          <EmptyState icon={Wallet} title="No payout entitlement for this lead." />
        ) : (
          <ul className="grid gap-2 text-sm">
            {ents.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200/80 px-4 py-3">
                <PayoutStateBadge state={e.state} />
                <span className="text-base font-semibold tabular-nums">{formatInr(e.amountInr)}</span>
                <span className="text-muted-foreground min-w-0 text-xs">
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

function Field({ k, v, muted, mono }: { k: string; v: string; muted?: boolean; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-b border-slate-100 px-3 py-2 last:border-0 odd:bg-slate-50/50">
      <dt className={mono ? 'font-mono text-[11px] break-all text-slate-500' : 'text-slate-500'}>{k}</dt>
      <dd className={muted ? 'text-slate-400 italic' : 'break-words text-slate-900'}>{v === '' ? <em>blank</em> : v}</dd>
    </div>
  );
}
