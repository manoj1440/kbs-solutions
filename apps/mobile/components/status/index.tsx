import { formatDateTime, payoutStateLabel, payoutStateTone, type Provenance, PROVENANCE_LABEL, type StatusField, type StatusKind, statusTone } from '@kbs/shared';
import { Text as RNText, View } from 'react-native';

import { Badge } from '@/components/ui';

/** F-803 (mobile): distinct Stage / Decision / Activation badges; text always present (REQ-20 §20.2). */
function StatusBadge({ kind, label, field }: { kind: StatusKind; label: string; field: StatusField }) {
  return (
    <View className="flex-row items-center gap-1">
      <RNText className="text-xs text-muted-foreground">{label}:</RNText>
      <Badge label={field.display} variant={statusTone(kind, field)} />
    </View>
  );
}
export const StageBadge = (p: { field: StatusField }) => <StatusBadge kind="stage" label="Stage" field={p.field} />;
export const DecisionBadge = (p: { field: StatusField }) => <StatusBadge kind="decision" label="Decision" field={p.field} />;
export const ActivationBadge = (p: { field: StatusField }) => <StatusBadge kind="activation" label="Activation" field={p.field} />;

const BG: Record<Provenance, string> = { BANK_MIS: 'bg-provenance-bank-mis', KBS_OPERATIONAL: 'bg-provenance-kbs-operational', KBS_PAYMENT: 'bg-provenance-kbs-payment' };
const FG: Record<Provenance, string> = {
  BANK_MIS: 'text-provenance-bank-mis-foreground',
  KBS_OPERATIONAL: 'text-provenance-kbs-operational-foreground',
  KBS_PAYMENT: 'text-provenance-kbs-payment-foreground',
};

export function ProvenanceChip({ provenance, asOf }: { provenance: Provenance; asOf?: string | null }) {
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${BG[provenance]}`}>
      <RNText className={`text-[11px] font-medium ${FG[provenance]}`}>
        {PROVENANCE_LABEL[provenance]}
        {asOf ? ` · as of ${formatDateTime(asOf)}` : ''}
      </RNText>
    </View>
  );
}

/** F-602/F-603: payout entitlement / request state, never merged with bank status. */
export function PayoutStateBadge({ state }: { state: string }) {
  return <Badge label={payoutStateLabel(state)} variant={payoutStateTone(state)} />;
}
