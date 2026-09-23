import {
  ApiClientError,
  formatDateTime,
  type LeadStatusRow,
  type MisHistoryGroup,
  type OperationalEvent,
  shareStatusLabel,
} from '@kbs/shared';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';

import { CopyValue, FieldRow, MetaLine, SectionCard, Timeline } from '@/components/advisor/parts';
import { ShareButtons } from '@/components/share-buttons';
import { ProvenanceChip, StatusTrio } from '@/components/status';
import {
  AppBar,
  Appear,
  Avatar,
  Badge,
  Button,
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  ErrorText,
  Icon,
  type IconName,
  Input,
  KeyValue,
  Muted,
  Screen,
  Segmented,
  Skeleton,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';

interface LeadDetail extends Omit<LeadStatusRow, 'bankReference'> {
  customerPanMasked: string | null;
  panVerificationStatus: string;
  cardId: string;
  pincode: string;
  city: string | null;
  state: string | null;
  employmentType: string;
  annualIncomeItr: number;
  operationalEvents: OperationalEvent[];
  followUps: {
    id: string;
    text: string;
    dueAt: string;
    doneAt: string | null;
    owner: { id: string; fullName: string };
  }[];
  remarks: {
    id: string;
    text: string;
    at: string;
    editedAt: string | null;
    author: { id: string; fullName: string };
  }[];
  bankStatus: {
    matched: boolean;
    provenance: string;
    lastMatchedAt: string | null;
    lastMatchedBatchRef: string | null;
    finalDecisionDate: string | null;
    raw: Record<string, string> | null;
  };
  bankRemarks: { remarks: RemarkField[]; kyc: RemarkField[] };
  bankReference: {
    value: string | null;
    kind?: string;
    status?: string;
    label?: string;
    at?: string;
  };
  referenceHistory: {
    id: string;
    value: string;
    status: string;
    at: string;
    supersededAt: string | null;
  }[];
  linkActivity: { id: string; action: string; linkVersion: number; at: string; label: string }[];
  shares: { id: string; kind: string; at: string; handoffResult: string; deliveryStatus: string }[];
}
interface RemarkField {
  field: string;
  label: string;
  raw: string | null;
  display: string;
}

type Tab = 'overview' | 'bank' | 'activity';

const CHANGE_LABEL: Record<string, string> = {
  SET: 'set',
  CHANGED: 'changed',
  CONFIRMED_SAME: 'confirmed unchanged',
  REPORTED_BLANK: 'reported blank',
  ABSENT_FROM_BATCH: 'absent from batch',
};
const EVENT_ICON: Record<OperationalEvent['kind'], IconName> = {
  LEAD_CREATED: 'add-circle-outline',
  LINK_SHARED: 'share-social-outline',
  LINK_OPENED: 'open-outline',
  BANK_REFERENCE_ENTERED: 'pricetag-outline',
  BANK_REFERENCE_CORRECTED: 'create-outline',
  SHARE_SENT: 'paper-plane-outline',
  FOLLOW_UP_TASK: 'alarm-outline',
  OPERATIONAL_REMARK: 'chatbox-ellipses-outline',
};
const SHARE_KIND: Record<string, string> = {
  APPLICATION_LINK: 'Application link',
  BENEFIT_PDF: 'Benefit PDF',
  OFFICE_ID: 'Official ID',
};
const RAW_PREVIEW = 8;

/**
 * F-408 lead detail: A customer + KBS activity, B references + raw snapshot, C bank remarks / KYC, MIS history by batch.
 * KBS activity is a chronological log only — never a bank-stage timeline (VIEW-02).
 */
export default function LeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<LeadDetail | null>(null);
  const [history, setHistory] = useState<MisHistoryGroup[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [rawAll, setRawAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ref, setRef] = useState('');
  const [taskText, setTaskText] = useState('');
  const [taskDays, setTaskDays] = useState(1);
  const [remark, setRemark] = useState('');
  const [kind, setKind] = useState<'APPLICATION_NO' | 'APPLICATION_REFERENCE_NUMBER' | 'OTHER'>(
    'APPLICATION_NO',
  );
  const load = useCallback(async () => {
    try {
      const [d, h] = await Promise.all([
        api.get<LeadDetail>(`/leads/${id}`),
        api.get<MisHistoryGroup[]>(`/leads/${id}/mis-history`),
      ]);
      setL(d.data);
      setHistory(h.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the lead.');
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const open = async () => {
    try {
      const r = await api.post<{ url: string }>(`/leads/${id}/link/open`, {});
      await Linking.openURL(r.data.url);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not open the link.');
    }
  };
  const saveRef = async () => {
    try {
      await api.post(`/leads/${id}/bank-reference`, { referenceKind: kind, referenceValue: ref });
      setRef('');
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not save the reference.');
    }
  };
  const addTask = async () => {
    try {
      await api.post(`/leads/${id}/follow-ups`, {
        text: taskText.trim(),
        dueAt: new Date(Date.now() + taskDays * 86_400_000).toISOString(),
      });
      setTaskText('');
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not create the task.');
    }
  };
  const addRemark = async () => {
    try {
      await api.post(`/leads/${id}/remarks`, { text: remark.trim() });
      setRemark('');
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not add the remark.');
    }
  };
  const doneTask = async (taskId: string) => {
    try {
      await api.post(`/follow-ups/${taskId}/done`, {});
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not update the task.');
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!l) {
    return (
      <Screen scroll header={<AppBar title="Lead" />}>
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null);
              void load();
            }}
          />
        ) : (
          <View accessibilityLabel="Loading" className="gap-4">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </View>
        )}
      </Screen>
    );
  }

  const verified = l.bankReference.status === 'VERIFIED_BY_MIS_MATCH';
  const openTasks = l.followUps.filter((t) => !t.doneAt).length;
  const rawEntries = l.bankStatus.raw ? Object.entries(l.bankStatus.raw) : [];
  const rawShown = rawAll ? rawEntries : rawEntries.slice(0, RAW_PREVIEW);
  const earlierRefs = l.referenceHistory.filter((h) => h.supersededAt);

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      header={<AppBar title={l.customer.name} subtitle={`KBS ${l.kbsRef}`} />}
    >
      {error ? <ErrorText>{error}</ErrorText> : null}

      {/* Hero summary */}
      <Appear>
        <View
          className="overflow-hidden rounded-3xl p-5"
          style={[gradientStyle(gradients.hero, 135), shadow.lg]}
        >
          <View
            pointerEvents="none"
            className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/[0.07]"
          />
          <View
            pointerEvents="none"
            className="absolute -bottom-16 left-10 h-32 w-32 rounded-full"
            style={{ backgroundColor: 'rgba(245, 185, 66, 0.10)' }}
          />
          <View className="flex-row items-center gap-3">
            <Avatar name={l.customer.name} size={52} light />
            <View className="flex-1">
              <RNText numberOfLines={1} className="font-bold text-[20px] text-white">
                {l.customer.name}
              </RNText>
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <Icon name="card-outline" size={13} color="rgba(255,255,255,0.7)" />
                <RNText numberOfLines={1} className="flex-1 font-medium text-[13px] text-white/75">
                  {l.bank.displayName} · {l.card.name}
                </RNText>
              </View>
            </View>
          </View>
          <View className="mt-5 rounded-2xl bg-white/10 px-3.5">
            <View className="min-h-[48px] flex-row items-center justify-between gap-3 border-b border-white/10 py-2">
              <RNText className="font-semibold text-[10px] uppercase tracking-[1px] text-white/60">
                KBS reference
              </RNText>
              <CopyValue value={l.kbsRef} light />
            </View>
            <View className="min-h-[48px] flex-row items-center justify-between gap-3 py-2">
              <RNText className="font-semibold text-[10px] uppercase tracking-[1px] text-white/60">
                Bank reference
              </RNText>
              {l.bankReference.value ? (
                <View className="items-end gap-0.5">
                  <CopyValue value={l.bankReference.value} light />
                  <View className="flex-row items-center gap-1">
                    <Icon
                      name={verified ? 'shield-checkmark' : 'alert-circle-outline'}
                      size={12}
                      color={verified ? '#86EFAC' : colors.gold}
                    />
                    <RNText
                      className="font-semibold text-[11px]"
                      style={{ color: verified ? '#86EFAC' : colors.gold }}
                    >
                      {verified ? 'Verified by MIS match' : 'Unverified'}
                    </RNText>
                  </View>
                </View>
              ) : (
                <RNText className="flex-1 text-right font-medium text-[12px] leading-[16px] text-white/70">
                  {l.bankReference.label ?? 'Bank application reference not yet available'}
                </RNText>
              )}
            </View>
          </View>
          <View className="mt-4 flex-row items-center gap-1.5">
            <Icon name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
            <RNText className="font-medium text-[12px] text-white/60">
              Created {formatDateTime(l.leadCreatedAt)} (KBS activity)
            </RNText>
          </View>
        </View>
      </Appear>

      {/* Bank status — MIS only */}
      <Appear index={1}>
        <SectionCard
          icon="business-outline"
          tone="info"
          title="Bank status (from MIS only)"
          subtitle="Stage, decision and activation exactly as the bank reported"
        >
          <StatusTrio stage={l.stage} decision={l.decision} activation={l.activation} />
          <ProvenanceChip provenance="BANK_MIS" asOf={l.lastMatchedAt} />
          <MetaLine icon={l.bankStatus.matched ? 'sync-outline' : 'hourglass-outline'}>
            {l.bankStatus.matched
              ? `Exact values from bank MIS batch ${l.bankStatus.lastMatchedBatchRef ?? ''}.`
              : 'No MIS row has matched this lead yet.'}
          </MetaLine>
          {l.remarksPreview ? (
            <View className="rounded-xl bg-[#F4F6FB] px-3 py-2.5">
              <Muted className="italic">“{l.remarksPreview}”</Muted>
            </View>
          ) : null}
        </SectionCard>
      </Appear>

      <Appear index={2}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { key: 'overview', label: 'Overview' },
            { key: 'bank', label: 'Bank data', count: history.length || undefined },
            { key: 'activity', label: 'Activity', count: openTasks || undefined },
          ]}
        />
      </Appear>

      {tab === 'overview' ? (
        <>
          <Appear index={3}>
            <SectionCard
              icon="person-outline"
              title="Customer"
              subtitle="Masked — full numbers are never shown"
            >
              <View>
                <KeyValue label="Mobile" value={l.customer.mobileMasked} />
                <KeyValue
                  label="PAN"
                  value={
                    <View className="items-end gap-1">
                      <RNText
                        selectable
                        className="font-semibold text-[14px] tracking-wide text-ink"
                      >
                        {l.customerPanMasked ?? '—'}
                      </RNText>
                      <Badge
                        label={l.panVerificationStatus.toLowerCase()}
                        variant={l.panVerificationStatus === 'VERIFIED' ? 'success' : 'warning'}
                        size="sm"
                      />
                    </View>
                  }
                />
                <KeyValue
                  label="Location"
                  value={`${l.pincode} · ${l.city ?? '—'}, ${l.state ?? '—'}`}
                />
                <KeyValue
                  label="Employment"
                  value={l.employmentType.toLowerCase().replace(/_/g, ' ')}
                />
                <KeyValue
                  label="Annual income (ITR)"
                  value={`₹${l.annualIncomeItr.toLocaleString('en-IN')}`}
                  last
                />
              </View>
            </SectionCard>
          </Appear>

          <Appear index={4}>
            <SectionCard
              icon="link-outline"
              title="Application link"
              subtitle="Opening or sharing is KBS activity — it never sets a bank status"
            >
              <Button
                title="Open application link"
                icon="open-outline"
                variant="outline"
                onPress={() => void open()}
              />
              <ShareButtons
                target={{ type: 'LEAD', id: l.id }}
                cardId={l.cardId}
                kinds={['APPLICATION_LINK']}
                onShared={() =>
                  void api
                    .post(`/leads/${id}/link/share`, {})
                    .then(load)
                    .catch(() => undefined)
                }
              />
              {l.linkActivity.length ? (
                <View className="gap-2 rounded-xl bg-[#F4F6FB] p-3">
                  {l.linkActivity.map((a) => (
                    <MetaLine key={a.id} icon="radio-button-on-outline">
                      {formatDateTime(a.at)} · {a.label} (v{a.linkVersion})
                    </MetaLine>
                  ))}
                </View>
              ) : null}
            </SectionCard>
          </Appear>

          <Appear index={5}>
            <SectionCard
              icon="pricetag-outline"
              tone={verified ? 'success' : 'warning'}
              title="Bank application reference"
            >
              {l.bankReference.value ? (
                <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F4F6FB] px-3 py-2.5">
                  <CopyValue value={l.bankReference.value} />
                  <Badge
                    label={verified ? 'Verified by MIS match' : 'Unverified'}
                    variant={verified ? 'success' : 'warning'}
                    icon={verified ? 'shield-checkmark' : 'alert-circle-outline'}
                  />
                </View>
              ) : (
                <Muted>
                  {l.bankReference.label ?? 'Bank application reference not yet available'}
                </Muted>
              )}
              {!verified ? (
                <View className="gap-3">
                  <Segmented<typeof kind>
                    value={kind}
                    onChange={setKind}
                    options={[
                      { key: 'APPLICATION_NO', label: 'App no.' },
                      { key: 'APPLICATION_REFERENCE_NUMBER', label: 'Ref no.' },
                      { key: 'OTHER', label: 'Other' },
                    ]}
                  />
                  <Input
                    label="Reference exactly as the bank shows it"
                    icon="document-text-outline"
                    value={ref}
                    onChangeText={setRef}
                    autoCapitalize="none"
                  />
                  <Button
                    title={l.bankReference.value ? 'Correct reference' : 'Save reference'}
                    disabled={!ref.trim()}
                    onPress={() => void saveRef()}
                  />
                </View>
              ) : null}
              {earlierRefs.length ? (
                <View className="gap-1.5">
                  {earlierRefs.map((h) => (
                    <MetaLine key={h.id} icon="git-commit-outline">
                      Earlier: {h.value} ({formatDateTime(h.at)})
                    </MetaLine>
                  ))}
                </View>
              ) : null}
            </SectionCard>
          </Appear>
        </>
      ) : null}

      {tab === 'bank' ? (
        <>
          <Appear index={3}>
            <SectionCard
              icon="chatbubble-ellipses-outline"
              tone="info"
              title="Bank reason / remarks"
              subtitle="Named bank fields, verbatim"
            >
              <View>
                {l.bankRemarks.remarks.map((f, i, a) => (
                  <FieldRow
                    key={f.field}
                    label={f.label}
                    value={f.display}
                    unknown={f.raw === null}
                    last={i === a.length - 1}
                  />
                ))}
              </View>
            </SectionCard>
          </Appear>
          <Appear index={4}>
            <SectionCard
              icon="finger-print-outline"
              tone="info"
              title="Bank/KYC information"
              subtitle="Sub-statuses and dates from the bank"
            >
              <View>
                {l.bankRemarks.kyc.map((f, i, a) => (
                  <FieldRow
                    key={f.field}
                    label={f.label}
                    value={f.display}
                    unknown={f.raw === null}
                    last={i === a.length - 1}
                  />
                ))}
              </View>
            </SectionCard>
          </Appear>
          <Appear index={5}>
            <SectionCard
              icon="layers-outline"
              tone="info"
              title="MIS update history"
              subtitle={
                history.length
                  ? `${history.length} batch(es)`
                  : 'No MIS batch has matched this lead yet'
              }
            >
              {history.map((g, gi) => {
                const changed = g.changes.filter(
                  (c) =>
                    c.changeKind === 'SET' ||
                    c.changeKind === 'CHANGED' ||
                    c.changeKind === 'ABSENT_FROM_BATCH',
                );
                const quiet = g.changes.length - changed.length;
                return (
                  <View key={g.batchId} className="gap-2">
                    {gi ? <Divider /> : null}
                    <View className="flex-row items-center gap-2">
                      <Icon name="cloud-upload-outline" size={15} color={colors.info} />
                      <Text className="flex-1 font-semibold text-[13px]">
                        {g.publicRef} · imported {formatDateTime(g.importedAt)} by{' '}
                        {g.uploaderRole.toLowerCase()}
                      </Text>
                    </View>
                    {changed.length === 0 ? (
                      <Muted>Identical repeat — no bank value changed.</Muted>
                    ) : null}
                    {changed.map((c) => (
                      <View
                        key={`${g.batchId}-${c.field}`}
                        className="gap-1 rounded-xl bg-[#F4F6FB] px-3 py-2.5"
                      >
                        <View className="flex-row items-center justify-between gap-2">
                          <Text className="flex-1 font-semibold text-[13px]">
                            {c.field === '*' ? '(whole row)' : c.field}
                          </Text>
                          <Badge
                            label={CHANGE_LABEL[c.changeKind] ?? c.changeKind.toLowerCase()}
                            variant={c.changeKind === 'ABSENT_FROM_BATCH' ? 'warning' : 'info'}
                            size="sm"
                          />
                        </View>
                        <Muted className="text-[12px]">
                          {c.oldValue ?? 'blank'} → {c.newValue ?? 'blank'}
                          {c.reportedEventDate
                            ? ` · bank date ${formatDateTime(c.reportedEventDate)}`
                            : ''}
                        </Muted>
                      </View>
                    ))}
                    {quiet ? (
                      <Muted className="text-[12px]">
                        {quiet} field(s) confirmed unchanged or reported blank
                      </Muted>
                    ) : null}
                  </View>
                );
              })}
            </SectionCard>
          </Appear>
          <Appear index={6}>
            <SectionCard
              icon="code-slash-outline"
              tone="secondary"
              title="Raw bank values"
              subtitle={
                l.bankStatus.raw
                  ? `Batch ${l.bankStatus.lastMatchedBatchRef ?? ''}`
                  : 'Awaiting MIS Update'
              }
            >
              {l.bankStatus.raw ? (
                <View>
                  {rawShown.map(([k, v], i) => (
                    <FieldRow
                      key={k}
                      label={k}
                      value={v === '' ? '(blank)' : v}
                      unknown={v === ''}
                      last={i === rawShown.length - 1}
                    />
                  ))}
                  {rawEntries.length > RAW_PREVIEW ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: rawAll }}
                      onPress={() => setRawAll(!rawAll)}
                      className="mt-2 h-11 flex-row items-center justify-center gap-1 rounded-xl bg-[#EEF2FF]"
                    >
                      <RNText className="font-semibold text-[13px] text-brand">
                        {rawAll ? 'Show fewer fields' : `Show all ${rawEntries.length} fields`}
                      </RNText>
                      <Icon
                        name={rawAll ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.brand}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Muted>No MIS row has matched this lead yet.</Muted>
              )}
            </SectionCard>
          </Appear>
        </>
      ) : null}

      {tab === 'activity' ? (
        <>
          <Appear index={3}>
            <SectionCard
              icon="pulse-outline"
              tone="info"
              title="KBS activity"
              subtitle="Operational events — never a bank stage"
            >
              <ProvenanceChip provenance="KBS_OPERATIONAL" />
              {l.operationalEvents.length ? (
                <Timeline
                  items={l.operationalEvents.map((e) => ({
                    id: e.id,
                    title: e.label,
                    detail: e.detail,
                    meta: `${formatDateTime(e.at)} · KBS activity`,
                    icon: EVENT_ICON[e.kind],
                  }))}
                />
              ) : (
                <Muted>No KBS activity recorded yet.</Muted>
              )}
            </SectionCard>
          </Appear>

          <Appear index={4}>
            <SectionCard
              icon="alarm-outline"
              tone="warning"
              title="Follow-up tasks"
              subtitle="KBS activity — never changes bank status"
              right={
                openTasks ? <Badge label={`${openTasks} open`} variant="warning" size="sm" /> : null
              }
            >
              {l.followUps.map((t) => (
                <View key={t.id} className="flex-row items-start gap-3 rounded-xl bg-[#F4F6FB] p-3">
                  <Icon
                    name={t.doneAt ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={t.doneAt ? colors.success : colors.warning}
                  />
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Badge
                        label="Follow-up task"
                        variant={t.doneAt ? 'secondary' : 'warning'}
                        size="sm"
                      />
                    </View>
                    <Text
                      className={
                        t.doneAt ? 'text-[14px] text-[#5B6478] line-through' : 'text-[14px]'
                      }
                    >
                      {t.text}
                    </Text>
                    <Muted className="text-[12px]">
                      {t.owner.fullName} · due {formatDateTime(t.dueAt)}
                      {t.doneAt ? ` · done` : ''}
                    </Muted>
                  </View>
                  {!t.doneAt ? (
                    <Button
                      title="Mark done"
                      size="sm"
                      variant="secondary"
                      onPress={() => void doneTask(t.id)}
                    />
                  ) : null}
                </View>
              ))}
              <View className="gap-3">
                <Input
                  label="New follow-up task"
                  icon="add-circle-outline"
                  value={taskText}
                  onChangeText={setTaskText}
                  placeholder="What needs to be done"
                />
                <View className="flex-row flex-wrap gap-2">
                  {[1, 3, 7].map((d) => (
                    <Chip
                      key={d}
                      label={`in ${d} day${d > 1 ? 's' : ''}`}
                      active={taskDays === d}
                      onPress={() => setTaskDays(d)}
                    />
                  ))}
                </View>
                <Button
                  title="Add follow-up task"
                  icon="add"
                  disabled={taskText.trim().length < 3}
                  onPress={() => void addTask()}
                />
              </View>
            </SectionCard>
          </Appear>

          <Appear index={5}>
            <SectionCard
              icon="chatbox-ellipses-outline"
              title="My remarks"
              subtitle="KBS activity — never changes bank status"
            >
              {l.remarks.map((r) => (
                <View key={r.id} className="flex-row gap-3">
                  <Avatar name={r.author.fullName} size={32} />
                  <View className="flex-1 rounded-2xl rounded-tl-md bg-[#F4F6FB] px-3 py-2.5">
                    <Text className="text-[14px]">{r.text}</Text>
                    <Muted className="mt-1 text-[12px]">
                      {r.author.fullName} · {formatDateTime(r.at)}
                    </Muted>
                  </View>
                </View>
              ))}
              <Input
                label="Add operational remark"
                value={remark}
                onChangeText={setRemark}
                placeholder="Dated note with your name attached"
                multiline
              />
              <Button
                title="Add remark"
                icon="send"
                variant="outline"
                disabled={!remark.trim()}
                onPress={() => void addRemark()}
              />
            </SectionCard>
          </Appear>

          <Appear index={6}>
            <SectionCard
              icon="share-social-outline"
              title="Shares"
              subtitle="Share hand-offs logged for this lead"
            >
              {l.shares.length ? (
                <View>
                  {l.shares.map((s, i, a) => (
                    <View
                      key={s.id}
                      className={`flex-row items-center gap-3 py-2.5 ${i < a.length - 1 ? 'border-b border-line' : ''}`}
                    >
                      <Icon name="paper-plane-outline" size={18} color={colors.brand} />
                      <View className="flex-1">
                        <Text className="font-semibold text-[14px]">
                          {SHARE_KIND[s.kind] ?? s.kind.toLowerCase().replace(/_/g, ' ')}
                        </Text>
                        <Muted className="text-[12px]">{formatDateTime(s.at)}</Muted>
                      </View>
                      <Badge
                        label={shareStatusLabel({
                          channel: 'WHATSAPP_HANDOFF',
                          handoffResult: s.handoffResult,
                          deliveryStatus: s.deliveryStatus,
                        } as unknown as Parameters<typeof shareStatusLabel>[0])}
                        variant="secondary"
                        size="sm"
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState
                  compact
                  icon="share-social-outline"
                  title="Nothing shared yet"
                  body="Share the application link from the Overview tab."
                />
              )}
            </SectionCard>
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}
