import { ApiClientError, formatDateTime } from '@kbs/shared';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/session';
import { countdown, training, type TrainingMe } from '@/lib/training';

/** F-203: Training landing — three modules, deadline, current module, deactivation explanation (REQ-25 §25.2). */
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

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-10">
        <Heading>Training</Heading>
        {me?.deadlineAt ? (
          <Muted>
            Deadline {formatDateTime(me.deadlineAt)} · {countdown(me.deadlineAt)}
          </Muted>
        ) : null}
        <ErrorText>{error}</ErrorText>
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
            <Button title="Go to my queue" onPress={() => void refresh()} />
          </Card>
        ) : null}
        {me?.modules.map((m) => (
          <Card key={m.sequence} className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-medium">
                Module {m.sequence}: {m.title}
              </Text>
              <Badge label={m.status === 'PASSED' ? 'Passed' : m.status === 'LOCKED' ? 'Locked' : 'In progress'} variant={m.status === 'PASSED' ? 'success' : m.status === 'LOCKED' ? 'unknown' : 'info'} />
            </View>
            <Muted>
              Pass mark {m.passThresholdPct}%{m.bestScorePct !== null ? ` · best ${m.bestScorePct}%` : ''}
              {m.attemptsRemaining !== null ? ` · ${m.attemptsRemaining} attempts left` : ''}
            </Muted>
            {!m.published ? <Muted>Not published yet — contact the Admin.</Muted> : null}
            {m.status === 'IN_PROGRESS' && m.published && !blocked && !reactivatedNoWindow ? (
              <Link href={{ pathname: '/(gates)/training/module', params: { seq: String(m.sequence) } }} asChild>
                <Button title={m.videoCompletedAt || !m.videoFileId ? 'Open module' : 'Watch video'} />
              </Link>
            ) : null}
          </Card>
        ))}
        <Button title="Refresh" variant="outline" onPress={() => void load()} />
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  );
}
