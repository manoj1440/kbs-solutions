import { formatDateTime, type LeadStatusRow, type MisHistoryGroup, type OperationalEvent } from '@kbs/shared';
import Link from 'next/link';

import { type FollowUpDto, LeadOps, type RemarkDto } from '@/components/lead-ops';
import { ActivationBadge, DecisionBadge, FreshnessLabel, ProvenanceChip, StageBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

const CHANGE_LABEL: Record<string, string> = { SET: 'set', CHANGED: 'changed', CONFIRMED_SAME: 'confirmed unchanged', REPORTED_BLANK: 'reported blank', ABSENT_FROM_BATCH: 'absent from this batch' };

/**
 * F-408 — lead detail sections (REQ-11 §11.9): A operational (KBS activity), B bank references + latest raw snapshot,
 * C grouped bank remarks and Bank/KYC information, MIS change history grouped by batch (REQ-14 §14.6). No timeline.
 */
export async function LeadDetail({ id, backHref }: { id: string; backHref: string }) {
  const [d, h] = await Promise.all([apiFetch<LeadDetailDto>(`/leads/${id}`), apiFetch<MisHistoryGroup[]>(`/leads/${id}/mis-history`)]);
  const l = d.data;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-xs">KBS Lead ID {l.kbsRef}</p>
          <h1 className="text-2xl font-semibold">{l.customer.name}</h1>
          <p className="text-muted-foreground text-sm">
            {l.bank.displayName} · {l.card.name}
            {l.card.crosswalked && l.card.crosswalked.id !== l.card.id ? ` (bank product ${l.card.crosswalked.productCode} → ${l.card.crosswalked.name})` : ''} · created {formatDateTime(l.leadCreatedAt)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={backHref}>← Back to leads</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank status (from MIS only)</CardTitle>
          <CardDescription>Three independent bank-reported fields. Nothing here is inferred from KBS activity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="flex flex-wrap gap-3">
            <StageBadge field={l.stage} />
            <DecisionBadge field={l.decision} />
            <ActivationBadge field={l.activation} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceChip provenance="BANK_MIS" asOf={l.lastMatchedAt} batchRef={l.bankStatus.lastMatchedBatchRef} />
            <FreshnessLabel lastMatchedAt={l.lastMatchedAt} />
            {l.bankStatus.finalDecisionDate ? <span className="text-muted-foreground text-xs">Bank decision date {formatDateTime(l.bankStatus.finalDecisionDate)}</span> : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>A · Customer & KBS activity</CardTitle>
            <CardDescription>Operational events are labelled KBS activity and never stand in for a bank stage.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Mobile</dt>
              <dd>{l.customer.mobileMasked ?? '—'}</dd>
              <dt className="text-muted-foreground">PAN</dt>
              <dd>
                {l.customerPanMasked ?? '—'} <span className="text-muted-foreground text-xs">({l.panVerificationStatus.toLowerCase()})</span>
              </dd>
              <dt className="text-muted-foreground">Location</dt>
              <dd>
                {l.pincode} · {l.city ?? '—'}, {l.state ?? '—'}
              </dd>
              <dt className="text-muted-foreground">Employment</dt>
              <dd>
                {l.employmentType.toLowerCase().replace(/_/g, ' ')} · ₹{l.annualIncomeItr.toLocaleString('en-IN')} p.a.
              </dd>
            </dl>
            <ul className="grid gap-1">
              {l.operationalEvents.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-muted-foreground text-xs">{formatDateTime(e.at)}</span>
                  <span>{e.label}</span>
                  {e.detail ? <span className="text-muted-foreground text-xs">{e.detail}</span> : null}
                  <ProvenanceChip provenance="KBS_OPERATIONAL" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>B · Bank references & latest snapshot</CardTitle>
            <CardDescription>Exact values from the newest accepted MIS row for this lead.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              Reference:{' '}
              {l.bankReference.value ? (
                <>
                  <code>{l.bankReference.value}</code> <span className="text-muted-foreground text-xs">({l.bankReference.kind})</span>{' '}
                  <Badge variant={l.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'success' : 'warning'}>{l.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'Verified by MIS match' : 'Unverified'}</Badge>
                </>
              ) : (
                <span className="text-muted-foreground">{l.bankReference.label}</span>
              )}
            </p>
            {l.referenceHistory.filter((r) => r.supersededAt).length ? (
              <p className="text-muted-foreground text-xs">Earlier: {l.referenceHistory.filter((r) => r.supersededAt).map((r) => `${r.value} (${formatDateTime(r.at)})`).join(' · ')}</p>
            ) : null}
            {l.bankStatus.raw ? (
              <dl className="grid max-h-80 grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 overflow-auto text-xs">
                {Object.entries(l.bankStatus.raw).map(([k, v]) => (
                  <Field key={k} k={k} v={v} />
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground">No MIS row has matched this lead yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <LeadOps leadId={l.id} followUps={l.followUps} remarks={l.remarks} />

      <Card>
        <CardHeader>
          <CardTitle>C · Bank reason / remarks and Bank/KYC information</CardTitle>
          <CardDescription>Named bank fields, verbatim. Not editable through operational notes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="mb-1 font-medium">Bank reason / remarks</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              {l.bankRemarks.remarks.map((f) => (
                <Field key={f.field} k={f.label} v={f.display} muted={f.raw === null} />
              ))}
            </dl>
          </div>
          <div>
            <p className="mb-1 font-medium">Bank/KYC information</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              {l.bankRemarks.kyc.map((f) => (
                <Field key={f.field} k={f.label} v={f.display} muted={f.raw === null} />
              ))}
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MIS update history</CardTitle>
          <CardDescription>Grouped by imported batch: exact old → new bank value, reported bank event date, KBS import time and uploader role. Identical repeats show as confirmed unchanged.</CardDescription>
        </CardHeader>
        <CardContent>
          {h.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No MIS batch has matched this lead yet.</p>
          ) : (
            <div className="grid gap-4">
              {h.data.map((g) => {
                const changed = g.changes.filter((c) => c.changeKind === 'SET' || c.changeKind === 'CHANGED' || c.changeKind === 'ABSENT_FROM_BATCH');
                const quiet = g.changes.filter((c) => !changed.includes(c));
                return (
                  <div key={g.batchId} className="grid gap-1">
                    <p className="text-sm font-medium">
                      {g.publicRef} · imported {formatDateTime(g.importedAt)} by {g.uploaderRole.toLowerCase()}
                    </p>
                    {changed.length === 0 ? <p className="text-muted-foreground text-sm">Identical repeat — no bank value changed in this batch.</p> : <HistoryTable batchId={g.batchId} changes={changed} />}
                    {quiet.length ? (
                      <details className="text-xs">
                        <summary className="text-muted-foreground cursor-pointer">
                          {quiet.filter((c) => c.changeKind === 'CONFIRMED_SAME').length} field(s) confirmed unchanged · {quiet.filter((c) => c.changeKind === 'REPORTED_BLANK').length} reported blank
                        </summary>
                        <HistoryTable batchId={g.batchId} changes={quiet} />
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>D · Payout</CardTitle>
          <CardDescription>Payout entitlement and payment status appear here once the payouts module (F-603) is live. Nothing is implied by activation alone.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function HistoryTable({ batchId, changes }: { batchId: string; changes: MisHistoryGroup['changes'] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Old value</TableHead>
          <TableHead>New value</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>Reported bank event date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {changes.map((c) => (
          <TableRow key={`${batchId}-${c.field}`}>
            <TableCell className="font-mono text-xs">{c.field === '*' ? '(whole row)' : c.field}</TableCell>
            <TableCell className="text-xs">{c.oldValue ?? <em className="text-muted-foreground">blank</em>}</TableCell>
            <TableCell className="text-xs">{c.newValue ?? <em className="text-muted-foreground">blank</em>}</TableCell>
            <TableCell>
              <Badge variant={c.changeKind === 'CHANGED' || c.changeKind === 'SET' ? 'info' : c.changeKind === 'ABSENT_FROM_BATCH' ? 'warning' : 'secondary'}>{CHANGE_LABEL[c.changeKind] ?? c.changeKind.toLowerCase()}</Badge>
            </TableCell>
            <TableCell className="text-xs">{c.reportedEventDate ? formatDateTime(c.reportedEventDate) : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Field({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={muted ? 'text-muted-foreground italic' : ''}>{v === '' ? <em>blank</em> : v}</dd>
    </>
  );
}
