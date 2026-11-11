import { router } from 'expo-router';

import { MyAgentCodes } from '@/components/team/agent-codes';
import { ProfileView } from '@/components/team/profile-view';

/** Manager profile (F-805): identity header, account facts, own Agent Codes (REQ-10 §10.4), shortcuts, sign out. */
export default function Profile() {
  return (
    <ProfileView
      extra={<MyAgentCodes />}
      actions={[
        {
          icon: 'notifications-outline',
          title: 'Notifications',
          subtitle: 'Approvals, team and payout updates',
          onPress: () => router.push('/(manager)/notifications' as never),
        },
        {
          icon: 'person-add-outline',
          title: 'Create Telecaller',
          subtitle: 'Add a Telecaller who reports to you',
          tone: 'success',
          onPress: () => router.push('/(manager)/create-telecaller'),
        },
      ]}
    />
  );
}
