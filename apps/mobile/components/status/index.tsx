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

import { Badge, type IconName } from '@/components/ui';
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
      <RNText className="font-medium text-[11px] text-[#8A93A6]">{label}</RNText>
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
            className="flex-1 gap-1 rounded-xl px-2.5 py-2"
            style={{ backgroundColor: t.bg }}
          >
            <RNText className="font-semibold text-[10px] uppercase tracking-[0.8px] text-[#5B6478]">
              {label}
            </RNText>
            <View className="flex-row items-start gap-1.5">
              <View
                className="mt-[5px] h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: t.fg }}
              />
              <RNText
                className="flex-1 font-semibold text-[12px] leading-[16px]"
                style={{ color: t.fg }}
              >
                {f.display}
              </RNText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const PROV: Record<Provenance, { bg: string; fg: string; icon: IconName }> = {
  BANK_MIS: { bg: '#F1ECFB', fg: '#5B2BA8', icon: 'business' },
  KBS_OPERATIONAL: { bg: '#E4F3FA', fg: '#0B5E82', icon: 'pulse' },
  KBS_PAYMENT: { bg: '#E6F4EC', fg: '#1F6B45', icon: 'cash' },
};

export function ProvenanceChip({
  provenance,
  asOf,
}: {
  provenance: Provenance;
  asOf?: string | null;
}) {
  const p = PROV[provenance];
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: p.bg }}
    >
      <RNText className="font-semibold text-[11px]" style={{ color: p.fg }}>
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
