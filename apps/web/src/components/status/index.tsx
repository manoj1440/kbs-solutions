import type { Provenance, StatusField, StatusKind } from '@kbs/shared';
import { formatDateTime, payoutStateLabel, payoutStateTone, PROVENANCE_LABEL, statusTone } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * F-803: status + provenance components. Text is always rendered; tone only groups visually (REQ-20 §20.2).
 * Stage, Decision, Activation and Payout state are deliberately separate components (REQ-14 §14.3).
 */

function StatusBadge({ kind, field, label }: { kind: StatusKind; field: StatusField; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{label}:</span>
      <Badge variant={statusTone(kind, field)} title={field.raw ?? undefined}>
        {field.display}
      </Badge>
    </span>
  );
}

export const StageBadge = (p: { field: StatusField }) => <StatusBadge kind="stage" label="Stage" field={p.field} />;
export const DecisionBadge = (p: { field: StatusField }) => <StatusBadge kind="decision" label="Decision" field={p.field} />;
export const ActivationBadge = (p: { field: StatusField }) => <StatusBadge kind="activation" label="Activation" field={p.field} />;

const PROVENANCE_CLASS: Record<Provenance, string> = {
  BANK_MIS: 'bg-provenance-bank-mis text-provenance-bank-mis-foreground',
  KBS_OPERATIONAL: 'bg-provenance-kbs-operational text-provenance-kbs-operational-foreground',
  KBS_PAYMENT: 'bg-provenance-kbs-payment text-provenance-kbs-payment-foreground',
};

export function ProvenanceChip({ provenance, asOf, batchRef }: { provenance: Provenance; asOf?: string | null; batchRef?: string | null }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', PROVENANCE_CLASS[provenance])}>
      {PROVENANCE_LABEL[provenance]}
      {asOf ? <span className="opacity-80">· as of {formatDateTime(asOf)}</span> : null}
      {batchRef ? <span className="opacity-80">· {batchRef}</span> : null}
    </span>
  );
}

export function FreshnessLabel({ lastMatchedAt }: { lastMatchedAt: string | null }) {
  return <span className="text-muted-foreground text-xs">{lastMatchedAt ? `Last matched MIS: ${formatDateTime(lastMatchedAt)}` : 'Never matched to a bank MIS row'}</span>;
}

export function PayoutStateBadge({ state }: { state: string }) {
  return <Badge variant={payoutStateTone(state)}>{payoutStateLabel(state)}</Badge>;
}
