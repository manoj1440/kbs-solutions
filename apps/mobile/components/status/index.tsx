import { AWAITING_MIS_UPDATE, NOT_REPORTED, formatDateTime, type Provenance, type StatusField } from '@kbs/shared';
import { Text as RNText, View } from 'react-native';

import { Badge } from '@/components/ui';

/** F-803 (mobile): distinct Stage / Decision / Activation badges; text always present (REQ-20 §20.2). */
type Tone = 'success' | 'destructive' | 'warning' | 'info' | 'unknown' | 'secondary';

function toneFor(kind: 'stage' | 'decision' | 'activation', field: StatusField): Tone {
  if (!field.value || field.display === AWAITING_MIS_UPDATE || field.display === NOT_REPORTED) return 'unknown';
  const v = field.value.toUpperCase();
  if (kind === 'decision') return v === 'APPROVE' ? 'success' : v === 'DECLINE' ? 'destructive' : v === 'INPROCESS' ? 'warning' : 'secondary';
  if (kind === 'activation') return v.includes('ACTIVE') && !v.startsWith('INACTIVE') ? 'success' : v === 'INACTIVE' ? 'warning' : 'secondary';
  return 'info';
}

function StatusBadge({ kind, label, field }: { kind: 'stage' | 'decision' | 'activation'; label: string; field: StatusField }) {
  return (
    <View className="flex-row items-center gap-1">
      <RNText className="text-xs text-muted-foreground">{label}:</RNText>
      <Badge label={field.display} variant={toneFor(kind, field)} />
    </View>
  );
}
export const StageBadge = (p: { field: StatusField }) => <StatusBadge kind="stage" label="Stage" field={p.field} />;
export const DecisionBadge = (p: { field: StatusField }) => <StatusBadge kind="decision" label="Decision" field={p.field} />;
export const ActivationBadge = (p: { field: StatusField }) => <StatusBadge kind="activation" label="Activation" field={p.field} />;

const LABEL: Record<Provenance, string> = { BANK_MIS: 'Bank MIS', KBS_OPERATIONAL: 'KBS activity', KBS_PAYMENT: 'Accounts payment' };
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
        {LABEL[provenance]}
        {asOf ? ` · as of ${formatDateTime(asOf)}` : ''}
      </RNText>
    </View>
  );
}
