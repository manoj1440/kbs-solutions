import { router } from 'expo-router';
import { View } from 'react-native';

import { Badge, Button, Card, Heading, Muted, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function Profile() {
  const { user, signOut } = useSession();
  return (
    <Screen>
      <View className="gap-4">
        <Heading>Profile</Heading>
        <Card className="gap-2">
          <Text className="font-medium">{user?.fullName || '(name pending)'}</Text>
          <Muted>{user?.mobileMasked}</Muted>
          <Badge label={user?.role ?? ''} variant="secondary" />
          {user?.employeeCode ? <Muted>Employee code: {user.employeeCode}</Muted> : null}
          {user?.reportingParent ? <Muted>Reports to: {user.reportingParent.fullName}</Muted> : null}
        </Card>
        <Button title="Notifications" variant="outline" onPress={() => router.push('/(manager)/notifications' as never)} />
        <Button title="Sign out" variant="outline" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
