import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text as RNText, View } from 'react-native';

import { humanize, TimelineItem } from '@/components/team';
import {
  AppBar,
  Appear,
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  Icon,
  IconCircle,
  Input,
  Muted,
  ProgressBar,
  Screen,
  Segmented,
  Skeleton,
  SkeletonList,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';

interface Detail {
  telecaller: { id: string; fullName: string; employeeCode: string | null; status: string };
  status: string;
  deadlineAt: string | null;
  deadlinePassed: boolean;
  canReactivate: boolean;
  reactivationWindowHours: number | null;
  modules: {
    sequence: number;
    title: string;
    status: string;
    bestScorePct: number | null;
    attemptCount: number;
  }[];
  reactivations: {
    id: string;
    at: string;
    resumedAtModuleSequence: number;
    newDeadlineAt: string | null;
  }[];
}
const LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PASSED: 'Passed',
  EXPIRED_DEACTIVATED: 'Deadline passed',
  REACTIVATED_IN_PROGRESS: 'Reactivated',
};

/** F-204/F-205 (mobile): Telecaller training detail + reactivation. */
interface Ops {
  queueSize: number;
  attempts: {
    id: string;
    at: string;
    customer: { fullName: string };
    providerState: string;
    durationSec: number | null;
    recording: string;
  }[];
  outcomes: { id: string }[];
  shares: { id: string }[];
  followUps: { id: string; overdue: boolean }[];
}

interface Wfh {
  id: string;
  telecallerUserId: string;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  reason: string;
}

type Section = 'training' | 'calling' | 'access';

const trainingTone = (s: string) =>
  s === 'PASSED' ? 'success' : s === 'EXPIRED_DEACTIVATED' ? 'destructive' : 'info';
const moduleTone = (s: string) =>
  s === 'PASSED' ? 'success' : s === 'LOCKED' ? 'unknown' : 'info';

/** F-301: Manager grants / revokes a work-from-home exception (REQ-09 §9.1). Applies to the next request. */
function WfhCard({ telecallerId }: { telecallerId: string }) {
  const [rows, setRows] = useState<Wfh[] | null>(null);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setRows(
        (await api.get<Wfh[]>('/access-policy/wfh')).data.filter(
          (w) => w.telecallerUserId === telecallerId,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load WFH status.');
    }
  }, [telecallerId]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const open = rows?.find(
    (w) => !w.revokedAt && (!w.endsAt || new Date(w.endsAt).getTime() >= new Date().getTime()),
  );
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setReason('');
      setHours('');
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };
  const h = Number(hours);
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-3">
        <IconCircle
          icon={open ? 'home' : 'business'}
          tone={open ? 'info' : 'secondary'}
          size={40}
        />
        <View className="flex-1">
          <Text className="font-bold text-[15px]">Work from home</Text>
          {rows === null && !error ? (
            <Skeleton className="mt-1 h-3 w-32" />
          ) : (
            <Muted className="text-[12px]">
              {open ? 'Exception active' : 'Office network only'}
            </Muted>
          )}
        </View>
      </View>
      {rows === null && !error ? null : open ? (
        <>
          <Badge
            label={`WFH until ${open.endsAt ? formatDateTime(open.endsAt) : 'revoked'}`}
            variant="info"
            icon="home-outline"
          />
          <View className="rounded-xl bg-[#F6F8FC] px-3 py-2.5">
            <Muted className="text-[13px]">{open.reason}</Muted>
          </View>
          <Input
            label="Reason to revoke"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. back in the office"
          />
          <Button
            title={busy ? 'Revoking…' : 'Revoke WFH'}
            icon="close-circle-outline"
            variant="destructive"
            loading={busy}
            disabled={busy || reason.trim().length < 3}
            onPress={() =>
              act(() => api.post(`/access-policy/wfh/${open.id}/revoke`, { reason: reason.trim() }))
            }
          />
        </>
      ) : (
        <>
          <Callout kind="neutral" icon="wifi">
            Calling is allowed only from an office network.
          </Callout>
          <Input
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Why calling from outside the office"
          />
          <Input
            label="Hours (optional, empty = until revoked)"
            icon="time-outline"
            value={hours}
            onChangeText={setHours}
            keyboardType="number-pad"
            placeholder="e.g. 8"
          />
          <Button
            title={busy ? 'Granting…' : 'Grant WFH'}
            icon="home-outline"
            loading={busy}
            disabled={busy || reason.trim().length < 3 || (hours !== '' && !(h > 0))}
            onPress={() =>
              act(() =>
                api.post('/access-policy/wfh', {
                  telecallerUserId: telecallerId,
                  reason: reason.trim(),
                  endsAt: hours
                    ? new Date(new Date().getTime() + h * 3_600_000).toISOString()
                    : null,
                }),
              )
            }
          />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <View className="w-[31%] items-center rounded-2xl bg-[#F6F8FC] py-3">
      <RNText className="font-extrabold text-[20px]" style={{ color: tone ?? colors.ink }}>
        {value}
      </RNText>
      <RNText numberOfLines={1} className="font-medium text-[11px] text-[#5B6478]">
        {label}
      </RNText>
    </View>
  );
}

export default function TelecallerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [ops, setOps] = useState<Ops | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>('training');

  const load = useCallback(async () => {
    try {
      setD((await api.get<Detail>(`/telecallers/${id}/training`)).data);
      setOps((await api.get<Ops>(`/calling/team/telecallers/${id}/activity`)).data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load.');
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirm() {
    const msg =
      d?.reactivationWindowHours === null
        ? 'The new training window is not configured; the Telecaller will stay gated until the Admin sets it. Continue?'
        : `A new window of ${d?.reactivationWindowHours} hours starts now. Continue?`;
    Alert.alert('Reactivate training?', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reactivate',
        onPress: async () => {
          setBusy(true);
          try {
            await api.post(`/telecallers/${id}/training/reactivate`, { reason });
            await load();
          } catch (e) {
            setError(e instanceof ApiClientError ? e.message : 'Reactivation failed.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  const passed = d ? d.modules.filter((m) => m.status === 'PASSED').length : 0;
  const overdue = ops ? ops.followUps.filter((f) => f.overdue).length : 0;
  const connected = ops ? ops.attempts.filter((a) => a.providerState === 'ENDED').length : 0;

  return (
    <Screen
      scroll
      header={
        <AppBar
          title={d?.telecaller.fullName ?? 'Telecaller'}
          subtitle={d?.telecaller.employeeCode ?? 'Telecaller'}
        />
      }
    >
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!d && !error ? (
        <View className="gap-3">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <SkeletonList rows={3} />
        </View>
      ) : null}
      {d ? (
        <>
          <Appear>
            <View
              className="overflow-hidden rounded-3xl p-5"
              style={[gradientStyle(gradients.hero, 140), shadow.lg]}
            >
              <View
                pointerEvents="none"
                className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/[0.07]"
              />
              <View className="flex-row items-center gap-4">
                <Avatar name={d.telecaller.fullName} size={60} light />
                <View className="flex-1 gap-1">
                  <RNText numberOfLines={1} className="font-extrabold text-[20px] text-white">
                    {d.telecaller.fullName}
                  </RNText>
                  {d.telecaller.employeeCode ? (
                    <RNText className="font-medium text-[12px] text-white/70">
                      {d.telecaller.employeeCode}
                    </RNText>
                  ) : null}
                  <View className="mt-1 self-start rounded-full bg-white px-0.5">
                    <Badge
                      label={LABEL[d.status] ?? d.status}
                      variant={trainingTone(d.status)}
                      dot
                      size="sm"
                    />
                  </View>
                </View>
              </View>
              <View className="mt-4 gap-2 rounded-2xl bg-white/10 p-3">
                <View className="flex-row items-center justify-between">
                  <RNText className="font-semibold text-[12px] text-white/85">
                    Training modules
                  </RNText>
                  <RNText className="font-bold text-[12px] text-white">
                    {passed} / {d.modules.length} passed
                  </RNText>
                </View>
                <ProgressBar
                  value={d.modules.length ? passed / d.modules.length : 0}
                  tone="gold"
                  light
                  height={6}
                />
                <View className="flex-row items-center gap-1.5">
                  <Icon name="time-outline" size={13} color="rgba(255,255,255,0.7)" />
                  <RNText className="font-medium text-[12px] text-white/70">
                    {d.deadlineAt
                      ? `Deadline ${formatDateTime(d.deadlineAt)}`
                      : 'Window starts at first login'}
                  </RNText>
                </View>
              </View>
            </View>
          </Appear>

          <Segmented<Section>
            options={[
              { key: 'training', label: 'Training' },
              { key: 'calling', label: 'Calling', count: overdue || undefined },
              { key: 'access', label: 'Access' },
            ]}
            value={section}
            onChange={setSection}
          />

          {section === 'training' ? (
            <Appear className="gap-3">
              <Card className="px-4 py-1">
                {d.modules.map((m, i) => (
                  <View
                    key={m.sequence}
                    className={`min-h-[60px] flex-row items-center gap-3 py-3 ${i === d.modules.length - 1 ? '' : 'border-b border-line'}`}
                  >
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: m.status === 'PASSED' ? colors.successSoft : '#EEF0F4',
                      }}
                    >
                      {m.status === 'PASSED' ? (
                        <Icon name="checkmark" size={18} color={colors.success} />
                      ) : m.status === 'LOCKED' ? (
                        <Icon name="lock-closed" size={15} color={colors.subtle} />
                      ) : (
                        <RNText className="font-bold text-[13px] text-ink">{m.sequence}</RNText>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text numberOfLines={1} className="font-semibold text-[14px]">
                        {m.sequence}. {m.title}
                      </Text>
                      <Muted className="text-[12px]">
                        {m.attemptCount} attempts
                        {m.bestScorePct !== null ? ` · best ${m.bestScorePct}%` : ''}
                      </Muted>
                    </View>
                    <Badge label={humanize(m.status)} variant={moduleTone(m.status)} size="sm" />
                  </View>
                ))}
              </Card>
              {d.canReactivate ? (
                <Card className="gap-3">
                  <View className="flex-row items-center gap-3">
                    <IconCircle icon="refresh-circle" tone="warning" size={40} />
                    <View className="flex-1">
                      <Text className="font-bold text-[15px]">Reactivate training</Text>
                      <Muted className="text-[12px]">
                        Resumes at the first module not passed; earlier passes are kept.
                      </Muted>
                    </View>
                  </View>
                  <Input
                    label="Reason"
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Why are you reactivating?"
                  />
                  <Button
                    title={busy ? 'Reactivating…' : 'Reactivate'}
                    icon="refresh"
                    loading={busy}
                    disabled={busy || reason.trim().length < 3}
                    onPress={confirm}
                  />
                </Card>
              ) : null}
              {d.reactivations.length ? (
                <Card>
                  {d.reactivations.map((r, i) => (
                    <TimelineItem
                      key={r.id}
                      icon="refresh"
                      tone="warning"
                      last={i === d.reactivations.length - 1}
                      title={`Reactivated ${formatDateTime(r.at)} → Module ${r.resumedAtModuleSequence}`}
                      meta={
                        r.newDeadlineAt
                          ? `(until ${formatDateTime(r.newDeadlineAt)})`
                          : '(window not configured)'
                      }
                    />
                  ))}
                </Card>
              ) : null}
            </Appear>
          ) : null}

          {section === 'calling' ? (
            <Appear className="gap-3">
              {ops ? (
                <>
                  <Card className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-bold text-[15px]">Calling — last 7 days</Text>
                      {overdue ? (
                        <Badge
                          label={`${overdue} follow-ups overdue`}
                          variant="destructive"
                          icon="alarm-outline"
                          size="sm"
                        />
                      ) : null}
                    </View>
                    <View className="flex-row flex-wrap justify-between gap-y-2">
                      <Stat label="Queue" value={ops.queueSize} />
                      <Stat label="Attempts" value={ops.attempts.length} />
                      <Stat label="Connected" value={connected} tone={colors.success} />
                      <Stat label="Outcomes" value={ops.outcomes.length} />
                      <Stat label="Shares" value={ops.shares.length} />
                      <Stat
                        label="Follow-ups"
                        value={ops.followUps.length}
                        tone={overdue ? colors.danger : undefined}
                      />
                    </View>
                  </Card>
                  {ops.attempts.length ? (
                    <Card>
                      {ops.attempts.slice(0, 5).map((a, i, arr) => (
                        <TimelineItem
                          key={a.id}
                          icon={a.providerState === 'ENDED' ? 'call' : 'call-outline'}
                          tone={
                            a.providerState === 'ENDED'
                              ? 'success'
                              : a.providerState === 'FAILED' || a.providerState === 'NO_ANSWER'
                                ? 'destructive'
                                : 'secondary'
                          }
                          last={i === arr.length - 1}
                          title={a.customer.fullName}
                          meta={`${formatDateTime(a.at)} · ${a.providerState.toLowerCase()}${a.durationSec ? ` · ${a.durationSec}s` : ''} · ${a.recording}`}
                        />
                      ))}
                    </Card>
                  ) : (
                    <EmptyState compact icon="call-outline" title="No calls in the last 7 days" />
                  )}
                  <Callout kind="neutral" icon="headset">
                    Recording playback is available on the web console (logged).
                  </Callout>
                </>
              ) : (
                <SkeletonList rows={2} />
              )}
            </Appear>
          ) : null}

          {section === 'access' ? (
            <Appear>
              <WfhCard telecallerId={d.telecaller.id} />
            </Appear>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
