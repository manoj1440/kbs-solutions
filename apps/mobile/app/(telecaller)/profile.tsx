import { router } from 'expo-router';

import { ProfileView } from '@/components/team/profile-view';

/** Telecaller profile (F-805): identity header, account facts, shortcuts, sign out. */
export default function Profile() {
  return (
    <ProfileView
      actions={[
        {
          icon: 'id-card-outline',
          title: 'My official ID',
          subtitle: 'Your KBS Solutions ID card',
          tone: 'gold',
          onPress: () => router.push('/(telecaller)/id-card'),
        },
        {
          icon: 'notifications-outline',
          title: 'Notifications',
          onPress: () => router.push('/(telecaller)/notifications' as never),
        },
      ]}
    />
  );
}
