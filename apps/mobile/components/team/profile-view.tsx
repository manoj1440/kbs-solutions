import type { ReactNode } from 'react';
import { Text as RNText, View } from 'react-native';

import {
  Appear,
  Avatar,
  Card,
  HeroHeader,
  type IconName,
  ListItem,
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
    <RNText
      numberOfLines={1}
      className="max-w-[55%] text-right font-normal text-md text-ink tabular-nums"
    >
      {children}
    </RNText>
  );
}

/** F-805 shared Manager / Telecaller profile: identity header, account facts, an optional role section (`extra`), shortcuts and a destructive sign-out row. */
export function ProfileView({ actions, extra }: { actions: ProfileAction[]; extra?: ReactNode }) {
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
    <Screen inset="none" scroll padded={false} contentClassName="pt-0">
      <HeroHeader>
        <RNText accessibilityRole="header" className="font-medium text-2xl text-ink">
          Profile
        </RNText>
        <View className="mt-5 flex-row items-center gap-4">
          <Avatar name={user?.fullName || 'KBS'} size={56} />
          <View className="flex-1">
            <RNText numberOfLines={1} className="font-medium text-lg text-ink">
              {name}
            </RNText>
            <View className="mt-1 flex-row items-center gap-2">
              <View className="flex-row items-center gap-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-orange" />
                <RNText className="font-normal text-sm text-[#525252]">
                  {user?.role ? humanize(user.role) : ''}
                </RNText>
              </View>
              {user?.publicRef ? (
                <RNText className="font-normal text-sm text-[#737373] tabular-nums">
                  · {user.publicRef}
                </RNText>
              ) : null}
            </View>
          </View>
        </View>
      </HeroHeader>

      <View className="mt-4 gap-5 px-4">
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

        {extra ? <Appear index={2}>{extra}</Appear> : null}

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
