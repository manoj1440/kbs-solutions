import {
  ApiClientError,
  formatDateTime,
  type LeadStatusRow,
  type MisHistoryGroup,
  type OperationalEvent,
} from '@kbs/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import {
  ActivationBadge,
  DecisionBadge,
  ProvenanceChip,
  StageBadge,
  StatusTrio,
} from '@/components/status';
import { TimelineItem } from '@/components/team';
import {
  AppBar,
  Appear,
  Avatar,
  Badge,
  Callout,
  Card,
  ErrorState,
  Icon,
  IconCircle,
  KeyValue,
  Muted,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonList,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

interface RemarkField {
  field: string;
  label: string;
  raw: string | null;
  display: string;
}
interface LeadDetail extends Omit<LeadStatusRow, 'bankReference'> {
  customerPanMasked: string | null;
  pincode: string;
  city: string | null;
  state: string | null;
  operationalEvents: OperationalEvent[];
  bankStatus: { matched: boolean; lastMatchedBatchRef: string | null };
  bankRemarks: { remarks: RemarkField[]; kyc: RemarkField[] };
  bankReference: { value: string | null; status?: string; label?: string };
  advisor?: { fullName: string } | null;
}
const CHANGE_LABEL: Record<string, string> = {
  SET: 'set',
  CHANGED: 'changed',
  ABSENT_FROM_BATCH: 'absent from batch',
};

function Fields({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: 'chatbox-ellipses-outline' | 'finger-print-outline';
  rows: RemarkField[];
}) {
  return (
    <Card className="gap-1 pb-2">
      <View className="mb-1 flex-row items-center gap-3">
        <IconCircle icon={icon} tone="secondary" size={34} />
        <Text className="flex-1 font-bold text-[15px]">{title}</Text>
      </View>
      {rows.map((f, i) => (
        <KeyValue
          key={f.field}
          label={f.label}
          last={i === rows.length - 1}
          value={
            <RNText
              className={`text-right text-[13px] ${f.raw === null ? 'font-normal italic text-[#8A93A6]' : 'font-semibold text-ink'}`}
            >
              {f.display}
            </RNText>
          }
        />
      ))}
    </Card>
  );
}

/**
 * F-315 (Manager mobile): read-only lead view — the Manager checks the Advisor's lead and its real MIS values.
 * Reference entry, link actions and follow-up tasks stay with the Advisor (F-407 / F-409).
 */
export default function ManagerLeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<LeadDetail | null>(null);
  const [history, setHistory] = useState<MisHistoryGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [d, h] = await Promise.all([
        api.get<LeadDetail>(`/leads/${id}`),
        api.get<MisHistoryGroup[]>(`/leads/${id}/mis-history`),
      ]);
      setL(d.data);
      setHistory(h.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the lead.');
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen
      scroll
      header={
        <AppBar
          title={l ? l.customer.name : 'Lead'}
          subtitle={l ? `KBS ${l.kbsRef} · read-only` : 'Read-only'}
        />
      }
    >
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!l && !error ? (
        <View className="gap-3">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <SkeletonList rows={3} />
        </View>
      ) : null}
      {l ? (
        <>
          <Appear>
            <Card className="gap-4">
              <View className="flex-row items-center gap-3">
                <Avatar name={l.customer.name} size={52} />
                <View className="flex-1">
                  <Muted className="text-[12px]">KBS {l.kbsRef}</Muted>
                  <Text numberOfLines={1} className="font-extrabold text-[19px]">
                    {l.customer.name}
                  </Text>
                  <Muted numberOfLines={2} className="text-[12px]">
                    {l.bank.displayName} {l.card.name} · created {formatDateTime(l.leadCreatedAt)}{' '}
                    (KBS activity)
                  </Muted>
                </View>
              </View>
              <StatusTrio stage={l.stage} decision={l.decision} activation={l.activation} />
            </Card>
          </Appear>

          <Appear index={1}>
            <Card className="gap-2.5">
              <View className="flex-row items-center gap-3">
                <IconCircle icon="business" tone="default" size={34} />
                <Text className="flex-1 font-bold text-[15px]">Bank status (from MIS only)</Text>
              </View>
              <StageBadge field={l.stage} />
              <DecisionBadge field={l.decision} />
              <ActivationBadge field={l.activation} />
              <ProvenanceChip provenance="BANK_MIS" asOf={l.lastMatchedAt} />
              <Muted className="text-[12px]">
                {l.bankStatus.matched
                  ? `Exact values from bank MIS batch ${l.bankStatus.lastMatchedBatchRef ?? ''}.`
                  : 'No MIS row has matched this lead yet.'}
              </Muted>
            </Card>
          </Appear>

          <Appear index={2}>
            <Card className="gap-1 pb-2">
              <View className="mb-1 flex-row items-center gap-3">
                <IconCircle icon="person" tone="info" size={34} />
                <Text className="flex-1 font-bold text-[15px]">Customer</Text>
              </View>
              <KeyValue label="Mobile" value={l.customer.mobileMasked ?? '—'} />
              {l.customerPanMasked ? <KeyValue label="PAN" value={l.customerPanMasked} /> : null}
              <KeyValue
                label="Location"
                value={`${l.pincode} · ${l.city ?? '—'}, ${l.state ?? '—'}`}
              />
              <KeyValue
                label="Bank reference"
                value={l.bankReference.value ?? l.bankReference.label ?? 'not yet available'}
                last
              />
            </Card>
          </Appear>

          <Appear index={3} className="gap-4">
            <Fields
              title="Bank reason / remarks (verbatim)"
              icon="chatbox-ellipses-outline"
              rows={l.bankRemarks.remarks}
            />
            <Fields
              title="Bank / KYC information"
              icon="finger-print-outline"
              rows={l.bankRemarks.kyc}
            />
          </Appear>

          <Appear index={4} className="gap-3">
            <SectionHeader title="MIS update history" />
            <Card>
              {history.length === 0 ? <Muted>No MIS batch has matched this lead yet.</Muted> : null}
              {history.map((g, gi) => {
                const changed = g.changes.filter(
                  (c) =>
                    c.changeKind === 'SET' ||
                    c.changeKind === 'CHANGED' ||
                    c.changeKind === 'ABSENT_FROM_BATCH',
                );
                return (
                  <TimelineItem
                    key={g.batchId}
                    icon="document-attach-outline"
                    tone="default"
                    title={g.publicRef}
                    meta={`imported ${formatDateTime(g.importedAt)}`}
                    last={gi === history.length - 1}
                  >
                    {changed.length === 0 ? (
                      <Muted className="mt-1 text-[12px]">
                        Identical repeat — no bank value changed.
                      </Muted>
                    ) : null}
                    {changed.map((c) => (
                      <View
                        key={`${g.batchId}-${c.field}`}
                        className="mt-2 gap-1 rounded-xl bg-[#F6F8FC] px-3 py-2"
                      >
                        <View className="flex-row flex-wrap items-center gap-2">
                          <RNText className="font-semibold text-[12px] text-ink">
                            {c.field === '*' ? '(whole row)' : c.field}
                          </RNText>
                          <Badge
                            label={CHANGE_LABEL[c.changeKind] ?? c.changeKind.toLowerCase()}
                            variant={c.changeKind === 'ABSENT_FROM_BATCH' ? 'warning' : 'info'}
                            size="sm"
                          />
                        </View>
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <Muted className="text-[12px]">{c.oldValue ?? 'blank'}</Muted>
                          <Icon name="arrow-forward" size={12} color={colors.subtle} />
                          <RNText className="font-semibold text-[12px] text-ink">
                            {c.newValue ?? 'blank'}
                          </RNText>
                        </View>
                      </View>
                    ))}
                  </TimelineItem>
                );
              })}
            </Card>
          </Appear>

          <Appear index={5} className="gap-3">
            <SectionHeader title="KBS activity" />
            <Callout kind="info" icon="pulse">
              Operational events — never a bank stage.
            </Callout>
            {l.operationalEvents.length ? (
              <Card>
                {l.operationalEvents.map((e, i) => (
                  <TimelineItem
                    key={e.id}
                    icon="pulse"
                    tone="info"
                    title={e.label}
                    meta={`${formatDateTime(e.at)}${e.detail ? ` · ${e.detail}` : ''}`}
                    last={i === l.operationalEvents.length - 1}
                  />
                ))}
              </Card>
            ) : null}
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}
