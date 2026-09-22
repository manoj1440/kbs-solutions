import { Link } from 'expo-router';
import { View } from 'react-native';

import { Button, Heading, Muted, Screen } from '@/components/ui';

/** S01 Welcome — KBS branding, no approval promises (REQ-12). */
export default function Welcome() {
  return (
    <Screen className="justify-between pb-10">
      <View className="mt-20 gap-3">
        <Heading>KBS Solutions</Heading>
        <Muted>Credit-card sales and operations for Telecallers, Advisors and Managers.</Muted>
        <Muted>Bank application status always comes from the bank&apos;s MIS files uploaded by KBS — never from this app.</Muted>
      </View>
      <View className="gap-3">
        <Link href="/(auth)/mobile?purpose=LOGIN" asChild>
          <Button title="Sign in" />
        </Link>
        <Link href="/(auth)/mobile?purpose=ADVISOR_SIGNUP" asChild>
          <Button title="Register as an Advisor" variant="outline" />
        </Link>
      </View>
    </Screen>
  );
}
