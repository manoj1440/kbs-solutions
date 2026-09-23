import { Text as RNText } from 'react-native';

import { GateState } from '@/components/auth';
import { Button, Card } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function Deactivated() {
  const { signOut, user } = useSession();
  return (
    <GateState
      icon="lock-closed"
      tone="destructive"
      title="Account not active"
      actions={
        <Button
          title="Sign out"
          size="lg"
          variant="outline"
          icon="log-out-outline"
          onPress={() => void signOut()}
        />
      }
    >
      <Card className="flex-row items-center gap-3 p-4">
        <RNText className="flex-1 text-center font-normal text-[15px] leading-[22px] text-[#374151]">
          {user?.role === 'TELECALLER'
            ? 'Contact your Manager to reactivate your account.'
            : 'Contact the KBS Admin.'}
        </RNText>
      </Card>
    </GateState>
  );
}
