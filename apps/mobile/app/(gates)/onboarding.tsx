import { View } from 'react-native';

import { Badge, Button, Card, Heading, Muted, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/session';

/** Advisor onboarding placeholder — the step screens arrive with F-401. */
export default function OnboardingGate() {
  const { gates, signOut, refresh } = useSession();
  const step = gates?.onboarding.step ?? 'PERSONAL';
  return (
    <Screen>
      <View className="gap-4">
        <Heading>Complete your onboarding</Heading>
        <Card className="gap-2">
          <Badge label={step === 'AWAITING_REVIEW' ? 'Awaiting KBS review' : `Step: ${step}`} variant={step === 'AWAITING_REVIEW' ? 'info' : 'warning'} />
          <Text>{step === 'AWAITING_REVIEW' ? 'KBS is reviewing your details. You will be notified when your account is ready.' : 'Identity verification, bank details and cancelled cheque are required before you can create leads.'}</Text>
          <Muted>Onboarding screens arrive with feature F-401.</Muted>
        </Card>
        <Button title="Refresh" variant="outline" onPress={() => void refresh()} />
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
