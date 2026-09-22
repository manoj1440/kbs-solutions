import { ApiClientError, formatDateTime } from '@kbs/shared';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/session';
import { countdown, training, type TrainingMe } from '@/lib/training';

const ICONS = ['💳', '🏦', '📜', '🤝', '📝'];

/** F-203 / S08 Training landing — progress bar, module states, Continue Learning (REQ-25 §25.2). */
export default function TrainingLanding() {
  const { signOut, refresh } = useSession();
  const [me, setMe] = useState<TrainingMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMe(await training.me());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load training.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const blocked = me?.deadlinePassed || me?.status === 'EXPIRED_DEACTIVATED';
  const reactivatedNoWindow = me?.status === 'REACTIVATED_IN_PROGRESS' && !me.deadlineAt;
  const modules = me?.modules ?? [];
  const done = modules.filter((m) => m.status === 'PASSED').length;
  const pct = modules.length ? Math.round((done / modules.length) * 100) : 0;
  const current = modules.find((m) => m.status === 'IN_PROGRESS' && m.published);

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-10 pt-6">
        <View className="gap-1">
          <Heading>Complete Your Training</Heading>
          <Muted>Learn · Understand · Start Earning</Muted>
          {me?.deadlineAt ? (
            <Muted>
              Deadline {formatDateTime(me.deadlineAt)} · {countdown(me.deadlineAt)}
            </Muted>
          ) : null}
        </View>
        <ErrorText>{error}</ErrorText>
        {modules.length ? (
          <View className="gap-1.5">
            <View className="flex-row justify-between">
              <Muted className="text-xs">
                {done}/{modules.length} modules completed
              </Muted>
              <Muted className="text-xs font-semibold">{pct}%</Muted>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-secondary">
              <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </View>
          </View>
        ) : null}
        {blocked ? (
          <Card className="gap-2">
            <Badge label="Training window ended" variant="destructive" />
            <Text>Your 72-hour window has ended. Ask your Manager to reactivate your training — you will resume at the first module you have not passed.</Text>
          </Card>
        ) : null}
        {reactivatedNoWindow ? (
          <Card className="gap-2">
            <Badge label="Waiting for Admin" variant="warning" />
            <Text>Training was reactivated but the new window is not configured yet. Contact the Admin.</Text>
          </Card>
        ) : null}
        {me?.status === 'PASSED' ? (
          <Card className="gap-2">
            <Badge label="All modules passed" variant="success" />
            <Text>Your calling queue is available.</Text>
            <Button title="Go to my queue" onPress={() => void refresh()} className="rounded-xl" />
          </Card>
        ) : null}
        {modules.map((m, i) => {
          const locked = m.status === 'LOCKED';
          const passed = m.status === 'PASSED';
          return (
            <Card key={m.sequence} className={`flex-row items-center gap-3 p-3.5 ${locked ? 'opacity-60' : ''}`}>
              <View className={`h-11 w-11 items-center justify-center rounded-full ${passed ? 'bg-success' : locked ? 'bg-secondary' : 'bg-info'}`}>
                <Text className="text-lg">{passed ? '✓' : locked ? '🔒' : ICONS[i % ICONS.length]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold" numberOfLines={1}>
                  {m.title}
                </Text>
                <Muted className="text-xs">
                  {passed ? 'Completed' : locked ? 'Locked' : 'In progress'} · pass {m.passThresholdPct}%
                  {m.bestScorePct !== null ? ` · best ${m.bestScorePct}%` : ''}
                  {m.attemptsRemaining !== null ? ` · ${m.attemptsRemaining} left` : ''}
                </Muted>
                {!m.published ? <Muted className="text-xs">Not published yet — contact the Admin.</Muted> : null}
              </View>
              {m.status === 'IN_PROGRESS' && m.published && !blocked && !reactivatedNoWindow ? (
                <Link href={{ pathname: '/(gates)/training/module', params: { seq: String(m.sequence) } }} asChild>
                  <Button title="Open" className="h-9 rounded-lg px-4" />
                </Link>
              ) : null}
            </Card>
          );
        })}
        {current && !blocked && !reactivatedNoWindow ? (
          <Link href={{ pathname: '/(gates)/training/module', params: { seq: String(current.sequence) } }} asChild>
            <Button title="Continue Learning" className="rounded-xl" />
          </Link>
        ) : null}
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  );
}
