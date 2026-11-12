import {
  ApiClientError,
  formatDateTime,
  formatInr,
  type LeadStatusRow,
  type MisHistoryGroup,
  type OperationalEvent,
  shareStatusLabel,
} from '@kbs/shared';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
import { colors } from '@/lib/theme';
import { withBank } from '@/lib/cards';

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
  payouts: {
    entitlementId: string;
    position: string;
    /** Set once the payout request is paid (Admin decides the amount). */
    amountInr: number | null;
    request: { publicRef: string; paidAt: string | null } | null;
  }[];
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
  // hidden tab, stays mounted: keyed by id so nothing from the previous record is shown or submitted
  return <LeadView key={id} id={id} />;
}

function LeadView({ id }: { id: string }) {
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
  // one action at a time: a double tap must not post twice, and an old error never outlives the next attempt
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const act = async (fallback: string, fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : fallback);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const open = () =>
    act('Could not open the link.', async () => {
      const r = await api.post<{ url: string }>(`/leads/${id}/link/open`, {});
      await Linking.openURL(r.data.url);
    });
  const saveRef = () =>
    act('Could not save the reference.', async () => {
      await api.post(`/leads/${id}/bank-reference`, { referenceKind: kind, referenceValue: ref });
      setRef('');
    });
  const addTask = () =>
    act('Could not create the task.', async () => {
      await api.post(`/leads/${id}/follow-ups`, {
        text: taskText.trim(),
        dueAt: new Date(Date.now() + taskDays * 86_400_000).toISOString(),
      });
      setTaskText('');
    });
  const addRemark = () =>
    act('Could not add the remark.', async () => {
      await api.post(`/leads/${id}/remarks`, { text: remark.trim() });
      setRemark('');
    });
  const doneTask = (taskId: string) =>
    act('Could not update the task.', async () => {
      await api.post(`/follow-ups/${taskId}/done`, {});
    });
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
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
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
      header={<AppBar title={l.customer.name} />}
    >
      {error ? <ErrorText>{error}</ErrorText> : null}

      {/* Hero summary */}
      <Appear>
        <View className="rounded-2xl bg-white p-4">
          <View className="flex-row items-center gap-3">
            <Avatar name={l.customer.name} size={44} />
            <View className="flex-1">
              <RNText numberOfLines={1} className="font-medium text-lg text-ink">
                {l.customer.name}
              </RNText>
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <Icon name="card-outline" size={16} color={colors.subtle} />
                <RNText numberOfLines={1} className="flex-1 font-normal text-sm text-[#525252]">
                  {withBank(l.bank, l.card.name, ' · ')}
                </RNText>
              </View>
            </View>
          </View>
          <View className="mt-4 rounded-lg bg-raised px-3">
            <View className="min-h-12 flex-row items-center justify-between gap-3 border-b border-line py-2">
              <RNText className="font-normal text-xs text-[#737373]">KBS reference</RNText>
              <CopyValue value={l.kbsRef} />
            </View>
            <View className="min-h-12 flex-row items-center justify-between gap-3 py-2">
              <RNText className="font-normal text-xs text-[#737373]">Bank reference</RNText>
              {l.bankReference.value ? (
                <View className="items-end gap-0.5">
                  <CopyValue value={l.bankReference.value} />
                  <View className="flex-row items-center gap-1">
                    <Icon
                      name={verified ? 'shield-checkmark-outline' : 'alert-circle-outline'}
                      size={16}
                      color={verified ? colors.success : colors.warning}
                    />
                    <RNText
                      className="font-normal text-xs"
                      style={{ color: verified ? colors.success : colors.warning }}
                    >
                      {verified ? 'Verified by MIS match' : 'Unverified'}
                    </RNText>
                  </View>
                </View>
              ) : (
                <RNText className="flex-1 text-right font-normal text-xs text-[#737373]">
                  {l.bankReference.label ?? 'Bank application reference not yet available'}
                </RNText>
              )}
            </View>
          </View>
          <View className="mt-4 flex-row items-center gap-1.5">
            <Icon name="time-outline" size={16} color={colors.subtle} />
            <RNText className="font-normal text-xs text-[#737373]">
              Created {formatDateTime(l.leadCreatedAt)} (KBS activity)
            </RNText>
          </View>
        </View>
      </Appear>

      {/* Bank status — MIS only */}
      <Appear index={1}>
        <SectionCard icon="business-outline" tone="info" title="Bank status (from MIS only)">
          <StatusTrio stage={l.stage} decision={l.decision} activation={l.activation} />
          <ProvenanceChip provenance="BANK_MIS" asOf={l.lastMatchedAt} />
          <MetaLine icon={l.bankStatus.matched ? 'sync-outline' : 'hourglass-outline'}>
            {l.bankStatus.matched
              ? `Exact values from bank MIS batch ${l.bankStatus.lastMatchedBatchRef ?? ''}.`
              : 'No MIS row has matched this lead yet.'}
          </MetaLine>
          {l.remarksPreview ? (
            <View className="rounded-lg bg-raised px-3 py-2.5">
              <Muted className="text-[#737373]">“{l.remarksPreview}”</Muted>
            </View>
          ) : null}
        </SectionCard>
      </Appear>

      {l.payouts.length ? (
        <Appear index={1}>
          <SectionCard
            icon="wallet-outline"
            tone="success"
            title="Your earning"
            subtitle="Card activated per the bank MIS; the amount shows once paid"
          >
            {l.payouts.map((p) => (
              <KeyValue
                key={p.entitlementId}
                label={p.amountInr != null ? formatInr(p.amountInr) : 'Card activated'}
                value={
                  <View className="items-end gap-1">
                    <Badge
                      label={p.position}
                      variant={
                        p.position === 'Paid'
                          ? 'success'
                          : p.position === 'Available for claim'
                            ? 'info'
                            : 'warning'
                      }
                    />
                    {p.request ? (
                      <Muted>
                        {p.request.publicRef}
                        {p.request.paidAt ? ` · paid ${formatDateTime(p.request.paidAt)}` : ''}
                      </Muted>
                    ) : null}
                  </View>
                }
              />
            ))}
          </SectionCard>
        </Appear>
      ) : null}

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
            <SectionCard icon="person-outline" title="Customer">
              <View>
                <KeyValue label="Mobile" value={l.customer.mobileMasked} />
                <KeyValue
                  label="PAN"
                  value={
                    <View className="items-end gap-1">
                      <RNText selectable className="font-medium text-md text-ink">
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
            <SectionCard icon="link-outline" title="Application link" subtitle="KBS activity">
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
                <View className="gap-2 rounded-lg bg-raised p-3">
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
                <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-lg bg-raised px-3 py-2.5">
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
                    disabled={busy || !ref.trim()}
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
                      <Icon name="cloud-upload-outline" size={16} color={colors.info} />
                      <Text className="flex-1 font-medium text-sm">
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
                        className="gap-1 rounded-lg bg-raised px-3 py-2.5"
                      >
                        <View className="flex-row items-center justify-between gap-2">
                          <Text className="flex-1 font-medium text-sm">
                            {c.field === '*' ? '(whole row)' : c.field}
                          </Text>
                          <Badge
                            label={CHANGE_LABEL[c.changeKind] ?? c.changeKind.toLowerCase()}
                            variant={c.changeKind === 'ABSENT_FROM_BATCH' ? 'warning' : 'info'}
                            size="sm"
                          />
                        </View>
                        <Muted className="text-xs">
                          {c.oldValue ?? 'blank'} → {c.newValue ?? 'blank'}
                          {c.reportedEventDate
                            ? ` · bank date ${formatDateTime(c.reportedEventDate)}`
                            : ''}
                        </Muted>
                      </View>
                    ))}
                    {quiet ? (
                      <Muted className="text-xs">
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
                      className="mt-2 h-11 flex-row items-center justify-center gap-1 rounded-lg bg-raised"
                    >
                      <RNText className="font-medium text-sm text-brand">
                        {rawAll ? 'Show fewer fields' : `Show all ${rawEntries.length} fields`}
                      </RNText>
                      <Icon
                        name={rawAll ? 'chevron-up' : 'chevron-down'}
                        size={16}
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
                <View key={t.id} className="flex-row items-start gap-3 rounded-lg bg-raised p-3">
                  <Icon
                    name={t.doneAt ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
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
                    <Text className={t.doneAt ? 'text-md text-[#525252] line-through' : 'text-md'}>
                      {t.text}
                    </Text>
                    <Muted className="text-xs">
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
                  disabled={busy || taskText.trim().length < 3}
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
                  <View className="flex-1 rounded-xl rounded-tl-md bg-raised px-3 py-2.5">
                    <Text className="text-md">{r.text}</Text>
                    <Muted className="mt-1 text-xs">
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
                disabled={busy || !remark.trim()}
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
                        <Text className="font-medium text-md">
                          {SHARE_KIND[s.kind] ?? s.kind.toLowerCase().replace(/_/g, ' ')}
                        </Text>
                        <Muted className="text-xs">{formatDateTime(s.at)}</Muted>
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
