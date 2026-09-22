import type { Provenance, StatusField } from '@kbs/shared';
import { AWAITING_MIS_UPDATE, NOT_REPORTED, formatDateTime } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * F-803: status + provenance components. Text is always rendered; tone only groups visually (REQ-20 §20.2).
 * Stage, Decision, Activation and Payout state are deliberately separate components (REQ-14 §14.3).
 */

type Tone = 'success' | 'destructive' | 'warning' | 'info' | 'unknown' | 'secondary';

function toneFor(kind: 'stage' | 'decision' | 'activation', field: StatusField): Tone {
  if (!field.value) return 'unknown';
  const v = field.value.toUpperCase();
  if (kind === 'decision') return v === 'APPROVE' ? 'success' : v === 'DECLINE' ? 'destructive' : v === 'INPROCESS' ? 'warning' : 'secondary';
  if (kind === 'activation') return v.includes('ACTIVE') && !v.startsWith('INACTIVE') ? 'success' : v === 'INACTIVE' ? 'warning' : 'secondary';
  return 'info';
}

function StatusBadge({ kind, field, label }: { kind: 'stage' | 'decision' | 'activation'; field: StatusField; label: string }) {
  const unknown = field.display === AWAITING_MIS_UPDATE || field.display === NOT_REPORTED;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{label}:</span>
      <Badge variant={unknown ? 'unknown' : toneFor(kind, field)} title={field.raw ?? undefined}>
        {field.display}
      </Badge>
    </span>
  );
}

export const StageBadge = (p: { field: StatusField }) => <StatusBadge kind="stage" label="Stage" field={p.field} />;
export const DecisionBadge = (p: { field: StatusField }) => <StatusBadge kind="decision" label="Decision" field={p.field} />;
export const ActivationBadge = (p: { field: StatusField }) => <StatusBadge kind="activation" label="Activation" field={p.field} />;

const PROVENANCE_LABEL: Record<Provenance, string> = { BANK_MIS: 'Bank MIS', KBS_OPERATIONAL: 'KBS activity', KBS_PAYMENT: 'Accounts payment' };
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
  const tone: Tone =
    state === 'PAID' ? 'success' : state === 'REJECTED' || state === 'ON_HOLD' || state === 'CANCELLED' ? 'destructive' : state === 'APPROVED' ? 'info' : state === 'ELIGIBLE_AVAILABLE' ? 'info' : 'warning';
  const label = state.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return <Badge variant={tone}>{label}</Badge>;
}
