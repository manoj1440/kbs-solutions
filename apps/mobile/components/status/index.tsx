import {
  formatDateTime,
  payoutStateLabel,
  payoutStateTone,
  type Provenance,
  PROVENANCE_LABEL,
  type StatusField,
  type StatusKind,
  statusTone,
} from '@kbs/shared';
import { Text as RNText, View } from 'react-native';

import { Badge } from '@/components/ui';
import { toneColors } from '@/lib/theme';

/**
 * F-803 (mobile) restyled in F-805: distinct Stage / Decision / Activation chips; the field name and the bank's own
 * text are always shown (REQ-20 §20.2) — tone only groups visually and never replaces the bank value.
 */
function StatusBadge({
  kind,
  label,
  field,
}: {
  kind: StatusKind;
  label: string;
  field: StatusField;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <RNText className="font-medium text-xs text-[#737373]">{label}</RNText>
      <Badge label={field.display} variant={statusTone(kind, field)} dot size="sm" />
    </View>
  );
}
export const StageBadge = (p: { field: StatusField }) => (
  <StatusBadge kind="stage" label="Stage" field={p.field} />
);
export const DecisionBadge = (p: { field: StatusField }) => (
  <StatusBadge kind="decision" label="Decision" field={p.field} />
);
export const ActivationBadge = (p: { field: StatusField }) => (
  <StatusBadge kind="activation" label="Activation" field={p.field} />
);

/** Three bank fields side by side as labelled cells — used on lead cards and lead headers. */
export function StatusTrio({
  stage,
  decision,
  activation,
}: {
  stage: StatusField;
  decision: StatusField;
  activation: StatusField;
}) {
  const cells: [string, StatusKind, StatusField][] = [
    ['Stage', 'stage', stage],
    ['Decision', 'decision', decision],
    ['Activation', 'activation', activation],
  ];
  return (
    <View className="flex-row gap-2">
      {cells.map(([label, kind, f]) => {
        const t = toneColors[statusTone(kind, f)];
        return (
          <View
            key={label}
            accessibilityLabel={`${label}: ${f.display}`}
            className="flex-1 gap-1 rounded-lg bg-raised px-3 py-2.5"
          >
            <RNText className="font-normal text-xs text-[#737373]">{label}</RNText>
            <View className="flex-row items-start gap-1.5">
              <View className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.fg }} />
              <RNText className="flex-1 font-medium text-sm text-ink">{f.display}</RNText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The app's signature: where a fact comes from. Provenance colours from @kbs/ui-tokens (REQ-20 §20.3) — used only as
 * the dot; the label stays quiet muted text so the source reads like a stamp in the margin of a ledger.
 */
export const PROVENANCE_DOT: Record<Provenance, string> = {
  BANK_MIS: '#5B2BA3',
  KBS_OPERATIONAL: '#215F7A',
  KBS_PAYMENT: '#246B47',
};

export function ProvenanceChip({
  provenance,
  asOf,
}: {
  provenance: Provenance;
  asOf?: string | null;
}) {
  return (
    <View className="flex-row items-center gap-1.5 self-start">
      <View
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: PROVENANCE_DOT[provenance] }}
      />
      <RNText className="font-normal text-xs text-[#737373] tabular-nums">
        {PROVENANCE_LABEL[provenance]}
        {asOf ? ` · as of ${formatDateTime(asOf)}` : ''}
      </RNText>
    </View>
  );
}

/** F-602/F-603: payout entitlement / request state, never merged with bank status. */
export function PayoutStateBadge({ state }: { state: string }) {
  return <Badge label={payoutStateLabel(state)} variant={payoutStateTone(state)} dot />;
}
