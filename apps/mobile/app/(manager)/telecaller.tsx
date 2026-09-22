import { ApiClientError, formatDateTime } from '@kbs/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Input, Label, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface Detail {
  telecaller: { id: string; fullName: string; employeeCode: string | null; status: string };
  status: string;
  deadlineAt: string | null;
  deadlinePassed: boolean;
  canReactivate: boolean;
  reactivationWindowHours: number | null;
  modules: { sequence: number; title: string; status: string; bestScorePct: number | null; attemptCount: number }[];
  reactivations: { id: string; at: string; resumedAtModuleSequence: number; newDeadlineAt: string | null }[];
}
const LABEL: Record<string, string> = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', PASSED: 'Passed', EXPIRED_DEACTIVATED: 'Deadline passed', REACTIVATED_IN_PROGRESS: 'Reactivated' };

/** F-204/F-205 (mobile): Telecaller training detail + reactivation. */
interface Ops {
  queueSize: number;
  attempts: { id: string; at: string; customer: { fullName: string }; providerState: string; durationSec: number | null; recording: string }[];
  outcomes: { id: string }[];
  shares: { id: string }[];
  followUps: { id: string; overdue: boolean }[];
}

export default function TelecallerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [ops, setOps] = useState<Ops | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setD((await api.get<Detail>(`/telecallers/${id}/training`)).data);
      setOps((await api.get<Ops>(`/calling/team/telecallers/${id}/activity`)).data);
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
    const msg = d?.reactivationWindowHours === null ? 'The new training window is not configured; the Telecaller will stay gated until the Admin sets it. Continue?' : `A new window of ${d?.reactivationWindowHours} hours starts now. Continue?`;
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

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-10">
        <Heading>{d?.telecaller.fullName ?? 'Telecaller'}</Heading>
        <Muted>{d?.telecaller.employeeCode}</Muted>
        <ErrorText>{error}</ErrorText>
        {d ? (
          <>
            <Card className="gap-2">
              <Badge label={LABEL[d.status] ?? d.status} variant={d.status === 'PASSED' ? 'success' : d.status === 'EXPIRED_DEACTIVATED' ? 'destructive' : 'info'} />
              <Muted>{d.deadlineAt ? `Deadline ${formatDateTime(d.deadlineAt)}` : 'Window starts at first login'}</Muted>
            </Card>
            {d.modules.map((m) => (
              <Card key={m.sequence} className="flex-row items-center justify-between">
                <View>
                  <Text className="font-medium">
                    {m.sequence}. {m.title}
                  </Text>
                  <Muted>
                    {m.attemptCount} attempts{m.bestScorePct !== null ? ` · best ${m.bestScorePct}%` : ''}
                  </Muted>
                </View>
                <Badge label={m.status} variant={m.status === 'PASSED' ? 'success' : m.status === 'LOCKED' ? 'unknown' : 'info'} />
              </Card>
            ))}
            {d.canReactivate ? (
              <Card className="gap-2">
                <Text className="font-medium">Reactivate training</Text>
                <Muted>Resumes at the first module not passed; earlier passes are kept.</Muted>
                <Label>Reason</Label>
                <Input value={reason} onChangeText={setReason} placeholder="Why are you reactivating?" />
                <Button title={busy ? 'Reactivating…' : 'Reactivate'} disabled={busy || reason.trim().length < 3} onPress={confirm} />
              </Card>
            ) : null}
            {d.reactivations.map((r) => (
              <Muted key={r.id}>
                Reactivated {formatDateTime(r.at)} → Module {r.resumedAtModuleSequence}
                {r.newDeadlineAt ? ` (until ${formatDateTime(r.newDeadlineAt)})` : ' (window not configured)'}
              </Muted>
            ))}
          </>
        ) : null}
        {ops ? (
          <Card className="gap-1">
            <Text className="font-medium">Calling — last 7 days</Text>
            <Muted>
              Queue {ops.queueSize} · attempts {ops.attempts.length} · connected {ops.attempts.filter((a) => a.providerState === 'ENDED').length} · outcomes {ops.outcomes.length} · shares {ops.shares.length}
            </Muted>
            {ops.followUps.filter((f) => f.overdue).length ? <Badge label={`${ops.followUps.filter((f) => f.overdue).length} follow-ups overdue`} variant="destructive" /> : null}
            {ops.attempts.slice(0, 5).map((a) => (
              <Muted key={a.id}>
                {formatDateTime(a.at)} · {a.customer.fullName} · {a.providerState.toLowerCase()}
                {a.durationSec ? ` · ${a.durationSec}s` : ''} · {a.recording}
              </Muted>
            ))}
            <Muted>Recording playback is available on the web console (logged).</Muted>
          </Card>
        ) : null}
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
