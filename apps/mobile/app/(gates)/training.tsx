import { formatDateTime } from '@kbs/shared';
import { View } from 'react-native';

import { Badge, Button, Card, Heading, Muted, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/session';

/** Training landing placeholder (F-203 delivers the modules). Shows the real deadline and reason from gates. */
export default function TrainingGate() {
  const { gates, signOut, refresh } = useSession();
  const t = gates?.training;
  const reason = t?.reason;
  return (
    <Screen>
      <View className="gap-4">
        <Heading>Training</Heading>
        {reason === 'DEADLINE_PASSED' ? (
          <Card className="gap-2">
            <Badge label="Training window ended" variant="destructive" />
            <Text>Your 72-hour training window has ended. Ask your Manager to reactivate your training — you will resume at the first module you have not passed.</Text>
          </Card>
        ) : reason === 'REACTIVATION_WINDOW_NOT_CONFIGURED' ? (
          <Card className="gap-2">
            <Badge label="Waiting for Admin" variant="warning" />
            <Text>Your training was reactivated, but the new training window is not configured yet. Contact the Admin.</Text>
          </Card>
        ) : (
          <Card className="gap-2">
            <Badge label={`Module ${t?.currentModuleSequence ?? 1} of 3`} variant="info" />
            <Text>Complete all three modules (video + questions) before the calling queue opens.</Text>
            {t?.deadlineAt ? <Muted>Deadline: {formatDateTime(t.deadlineAt)}</Muted> : null}
            <Muted>Module content arrives with feature F-203.</Muted>
          </Card>
        )}
        <Button title="Refresh status" variant="outline" onPress={() => void refresh()} />
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
