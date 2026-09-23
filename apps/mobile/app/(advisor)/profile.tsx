import {
  type AdvisorProfileView,
  agentCodeInput,
  ApiClientError,
  formatDateTime,
} from '@kbs/shared';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { SectionCard } from '@/components/advisor/parts';
import {
  AppBar,
  Appear,
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  ErrorText,
  Icon,
  Input,
  ListItem,
  Overline,
  Screen,
  Skeleton,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { gradients, gradientStyle, shadow } from '@/lib/theme';

/** F-410 Advisor profile: identity summary (status/date only), reporting + Agent Code (F-402), bank last4/IFSC, support. No files or full numbers. */
export default function Profile() {
  const { user, signOut, refresh } = useSession();
  const [p, setP] = useState<AdvisorProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setP((await api.get<AdvisorProfileView>('/me/profile')).data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the profile.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const name = p?.fullName || user?.fullName || '(name pending)';
  const idStatus = p?.identity.status;
  return (
    <Screen scroll header={<AppBar title="Profile" />}>
      <Appear>
        <View
          className="overflow-hidden rounded-3xl p-5"
          style={[gradientStyle(gradients.hero, 135), shadow.lg]}
        >
          <View
            pointerEvents="none"
            className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/[0.07]"
          />
          <View className="flex-row items-center gap-4">
            <Avatar name={name} size={60} light />
            <View className="flex-1 gap-0.5">
              <RNText numberOfLines={1} className="font-bold text-[20px] text-white">
                {name}
              </RNText>
              <RNText className="font-medium text-[13px] text-white/75">
                {p?.mobileMasked ?? user?.mobileMasked}
              </RNText>
              {p?.email ? (
                <RNText numberOfLines={1} className="font-medium text-[13px] text-white/75">
                  {p.email}
                </RNText>
              ) : null}
            </View>
          </View>
          <View className="mt-4 flex-row flex-wrap gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-gold px-3 py-1">
              <Icon name="briefcase" size={12} color="#0B1533" />
              <RNText className="font-bold text-[12px] text-ink">{user?.role ?? ''}</RNText>
            </View>
            {p?.reporting.agentCode ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                <Icon name="key-outline" size={12} color="#fff" />
                <RNText className="font-semibold text-[12px] text-white">
                  Agent Code {p.reporting.agentCode}
                </RNText>
              </View>
            ) : null}
          </View>
        </View>
      </Appear>

      {!p && !error ? (
        <View accessibilityLabel="Loading" className="gap-3">
          <Skeleton className="h-64 w-full rounded-2xl" />
        </View>
      ) : null}

      {p ? (
        <Appear index={1} className="gap-2">
          <Overline className="ml-1">Account</Overline>
          <Card className="px-4 py-1">
            <ListItem
              icon="shield-checkmark-outline"
              iconTone={
                idStatus === 'VERIFIED'
                  ? 'success'
                  : idStatus === 'FAILED'
                    ? 'destructive'
                    : 'warning'
              }
              title="Identity verification"
              subtitle={
                p.identity.verifiedAt
                  ? `verified ${formatDateTime(p.identity.verifiedAt)}`
                  : 'Only the outcome and date are kept here.'
              }
              right={
                <Badge
                  label={p.identity.status.toLowerCase().replace(/_/g, ' ')}
                  variant={
                    idStatus === 'VERIFIED'
                      ? 'success'
                      : idStatus === 'FAILED'
                        ? 'destructive'
                        : 'warning'
                  }
                  size="sm"
                />
              }
            />
            <ListItem
              icon="people-outline"
              title={
                p.reporting.parent
                  ? `${p.reporting.parent.fullName} (${p.reporting.parent.role.toLowerCase()})`
                  : 'KBS (no manager)'
              }
              subtitle={`Reporting · Agent Code: ${p.reporting.agentCode ?? '—'}${p.reporting.since ? ` · since ${formatDateTime(p.reporting.since)}` : ''}`}
            />
            <ListItem
              icon="card-outline"
              iconTone="gold"
              title="Payout bank account"
              subtitle={
                p.bank
                  ? `${p.bank.bankName} · ••••${p.bank.accountLast4} · ${p.bank.ifsc}`
                  : 'Not added yet.'
              }
            />
            {p.idCard ? (
              <ListItem
                icon="id-card-outline"
                iconTone="info"
                title="Official ID card"
                subtitle={`${p.idCard.publicRef} · active`}
              />
            ) : null}
            <ListItem
              icon="headset-outline"
              iconTone="secondary"
              title="Support"
              subtitle={p.support.contact ?? 'Contact your reporting Manager or KBS office.'}
              onPress={
                p.support.contact
                  ? () =>
                      void Linking.openURL(
                        p.support.contact!.includes('@')
                          ? `mailto:${p.support.contact}`
                          : `tel:${p.support.contact}`,
                      )
                  : undefined
              }
              last
            />
          </Card>
          {p.identity.verifiedAt ? (
            <RNText className="ml-1 font-normal text-[12px] text-[#8A93A6]">
              Identity: only the outcome and date are kept here.
            </RNText>
          ) : null}
          {p.reporting.pendingChange ? (
            <Callout
              kind="warning"
              title="Agent Code change pending"
            >{`Change to ${p.reporting.pendingChange.toAgentCode} awaiting Admin approval`}</Callout>
          ) : null}
        </Appear>
      ) : null}

      <Appear index={2}>
        <SectionCard
          icon="swap-horizontal-outline"
          title="Change Agent Code"
          subtitle="Applies from today under KBS policy; if you already have leads the change waits for Admin approval. Earlier leads and payouts keep their original attribution."
        >
          <Input
            label="Agent Code"
            icon="key-outline"
            value={code}
            autoCapitalize="characters"
            onChangeText={(t) => setCode(agentCodeInput(t))}
          />
          <Button
            title="Apply code"
            disabled={code.length < 4}
            onPress={async () => {
              setMsg(null);
              setError(null);
              try {
                const r = await api.post<{
                  status: 'APPLIED' | 'PENDING_APPROVAL';
                  reportingParent: { fullName: string };
                }>('/me/agent-code', { code });
                setMsg(
                  r.data.status === 'APPLIED'
                    ? `Now reporting to ${r.data.reportingParent.fullName}.`
                    : `Change to ${r.data.reportingParent.fullName} is awaiting Admin approval; your current reporting person is unchanged until then.`,
                );
                setCode('');
                await refresh();
                await load();
              } catch (e) {
                setError(e instanceof ApiClientError ? e.message : 'Could not apply the code.');
              }
            }}
          />
          {msg ? <Callout kind="success">{msg}</Callout> : null}
          <ErrorText>{error}</ErrorText>
        </SectionCard>
      </Appear>

      <Appear index={3}>
        <Card className="px-4 py-1">
          <ListItem
            icon="log-out-outline"
            title="Sign out"
            destructive
            chevron={false}
            onPress={() => void signOut()}
            last
          />
        </Card>
      </Appear>
    </Screen>
  );
}
