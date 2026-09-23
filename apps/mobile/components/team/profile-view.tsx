import type { ReactNode } from 'react';
import { Text as RNText, View } from 'react-native';

import {
  Appear,
  Avatar,
  Card,
  HeroHeader,
  type IconName,
  ListItem,
  Muted,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { humanize } from '@/components/team';
import { useSession } from '@/lib/session';

export interface ProfileAction {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: 'default' | 'gold' | 'info' | 'success';
}

function Value({ children }: { children: ReactNode }) {
  return (
    <RNText numberOfLines={1} className="max-w-[55%] text-right font-semibold text-[14px] text-ink">
      {children}
    </RNText>
  );
}

/** F-805 shared Manager / Telecaller profile: identity header, account facts, shortcuts and a destructive sign-out row. */
export function ProfileView({ actions }: { actions: ProfileAction[] }) {
  const { user, signOut } = useSession();
  const name = user?.fullName || '(name pending)';
  const facts: { icon: IconName; label: string; value: string }[] = [
    { icon: 'call-outline', label: 'Mobile', value: user?.mobileMasked ?? '—' },
    ...(user?.employeeCode
      ? [{ icon: 'id-card-outline' as IconName, label: 'Employee code', value: user.employeeCode }]
      : []),
    ...(user?.reportingParent
      ? [
          {
            icon: 'git-network-outline' as IconName,
            label: 'Reports to',
            value: user.reportingParent.fullName,
          },
        ]
      : []),
  ];
  return (
    <Screen inset="none" statusBar="light" scroll padded={false} contentClassName="pt-0">
      <HeroHeader className="items-center pb-16">
        <Muted className="self-start font-semibold text-[12px] uppercase tracking-[1.4px] text-white/60">
          Profile
        </Muted>
        <View className="mt-4 items-center">
          <Avatar name={user?.fullName || 'KBS'} size={84} light />
          <RNText
            numberOfLines={1}
            className="mt-3 font-extrabold text-[22px] tracking-tight text-white"
          >
            {name}
          </RNText>
          <View className="mt-2 flex-row items-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
              <View className="h-1.5 w-1.5 rounded-full bg-gold" />
              <RNText className="font-semibold text-[12px] text-white">
                {user?.role ? humanize(user.role) : ''}
              </RNText>
            </View>
            {user?.publicRef ? (
              <RNText className="font-medium text-[12px] text-white/60">{user.publicRef}</RNText>
            ) : null}
          </View>
        </View>
      </HeroHeader>

      <View className="-mt-10 gap-5 px-4">
        <Appear index={1}>
          <Card className="px-4 py-1">
            {facts.map((f, i) => (
              <ListItem
                key={f.label}
                icon={f.icon}
                title={f.label}
                right={<Value>{f.value}</Value>}
                last={i === facts.length - 1}
                chevron={false}
              />
            ))}
          </Card>
        </Appear>

        <Appear index={2} className="gap-3">
          <SectionHeader title="Shortcuts" />
          <Card className="px-4 py-1">
            {actions.map((a, i) => (
              <ListItem
                key={a.title}
                icon={a.icon}
                iconTone={a.tone ?? 'default'}
                title={a.title}
                subtitle={a.subtitle}
                onPress={a.onPress}
                last={i === actions.length - 1}
              />
            ))}
          </Card>
        </Appear>

        <Appear index={3}>
          <Card className="px-4 py-1">
            <ListItem
              icon="log-out-outline"
              title="Sign out"
              subtitle="You will need an OTP to sign in again"
              destructive
              onPress={() => void signOut()}
              chevron={false}
              last
            />
          </Card>
        </Appear>
      </View>
    </Screen>
  );
}
