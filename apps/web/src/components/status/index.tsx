import type { Provenance, StatusField, StatusKind, StatusTone } from '@kbs/shared';
import { formatDateTime, payoutStateLabel, payoutStateTone, PROVENANCE_LABEL, statusTone } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * F-803: status + provenance components. Text is always rendered; tone only groups visually (REQ-20 §20.2).
 * Stage, Decision, Activation and Payout state are deliberately separate components (REQ-14 §14.3).
 */

/** Tone → text colour (F-813: bank values render as plain coloured text, no chip). */
const TONE_TEXT: Record<StatusTone, string> = {
  success: 'text-success',
  destructive: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
  unknown: 'text-slate-600',
  secondary: 'text-slate-700',
};

function StatusBadge({ kind, field, label }: { kind: StatusKind; field: StatusField; label?: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-baseline gap-1.5">
      {label ? <span className="shrink-0 text-[11px] font-medium text-slate-500">{label}:</span> : null}
      <span title={field.raw ?? undefined} className={cn('min-w-0 max-w-full truncate text-[12.5px] font-semibold', TONE_TEXT[statusTone(kind, field)])}>
        {field.display}
      </span>
    </span>
  );
}

export const StageBadge = (p: { field: StatusField; label?: string | null }) => <StatusBadge kind="stage" label={p.label === null ? undefined : (p.label ?? 'Stage')} field={p.field} />;
export const DecisionBadge = (p: { field: StatusField; label?: string | null }) => <StatusBadge kind="decision" label={p.label === null ? undefined : (p.label ?? 'Decision')} field={p.field} />;
export const ActivationBadge = (p: { field: StatusField; label?: string | null }) => <StatusBadge kind="activation" label={p.label === null ? undefined : (p.label ?? 'Activation')} field={p.field} />;

const PROVENANCE_CLASS: Record<Provenance, string> = {
  BANK_MIS: 'bg-provenance-bank-mis/10 text-provenance-bank-mis ring-provenance-bank-mis/25',
  KBS_OPERATIONAL: 'bg-provenance-kbs-operational/10 text-provenance-kbs-operational ring-provenance-kbs-operational/25',
  KBS_PAYMENT: 'bg-provenance-kbs-payment/10 text-provenance-kbs-payment ring-provenance-kbs-payment/25',
};

export function ProvenanceChip({ provenance, asOf, batchRef }: { provenance: Provenance; asOf?: string | null; batchRef?: string | null }) {
  return (
    <span className={cn('inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', PROVENANCE_CLASS[provenance])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
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
