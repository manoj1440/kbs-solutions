import { View } from 'react-native';

import { Button, Card, Heading, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function Deactivated() {
  const { signOut, user } = useSession();
  return (
    <Screen>
      <View className="gap-4">
        <Heading>Account not active</Heading>
        <Card>
          <Text>{user?.role === 'TELECALLER' ? 'Contact your Manager to reactivate your account.' : 'Contact the KBS Admin.'}</Text>
        </Card>
        <Button title="Sign out" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
