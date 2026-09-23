import { router } from 'expo-router';

import { ProfileView } from '@/components/team/profile-view';

/** Manager profile (F-805): identity header, account facts, shortcuts, sign out. */
export default function Profile() {
  return (
    <ProfileView
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
