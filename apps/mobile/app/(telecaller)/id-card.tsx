import { ApiClientError, formatDate } from '@kbs/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { QrFromSvg } from '@/components/team/qr-from-svg';
import {
  AppBar,
  Appear,
  Avatar,
  Callout,
  Card,
  ErrorState,
  Icon,
  IconCircle,
  Muted,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';
import { api } from '@/lib/api';

interface IdCard {
  id: string;
  version: number;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt: string | null;
  fields: {
    fullName?: string;
    employeeCode?: string | null;
    role?: string;
    issuedAt?: string;
    verifyUrl?: string;
    publicRef?: string;
  };
  verifyUrl?: string;
  /** Server-rendered card image; only its verification QR is drawn here. */
  svg?: string;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="gap-0.5">
      <RNText className="font-semibold text-[9px] uppercase tracking-[1.2px] text-white/55">
        {label}
      </RNText>
      <RNText
        numberOfLines={1}
        className={`font-bold text-[13px] text-white ${mono ? 'tracking-[1px]' : ''}`}
      >
        {value}
      </RNText>
    </View>
  );
}

/** F-312 §3: Official ID screen. Sharing to a customer happens from that customer's record (F-311). */
export default function IdCardScreen() {
  const [card, setCard] = useState<IdCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setCard((await api.get<IdCard>('/id-cards/me')).data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your ID card.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const active = card?.status === 'ACTIVE';
  return (
    <Screen
      scroll
      header={
        <AppBar
          back={false}
          large
          title="Official ID"
          subtitle="Your KBS Solutions identity card"
        />
      }
    >
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!card && !error ? <Skeleton className="h-[440px] w-full rounded-[28px]" /> : null}
      {card ? (
        <>
          <Appear>
            <View
              className="overflow-hidden rounded-[28px]"
              style={[
                gradientStyle(active ? gradients.heroDeep : ['#3A3A3C', '#1C1C1E'], 150),
                shadow.lg,
              ]}
            >
              <View
                pointerEvents="none"
                className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/[0.06]"
              />
              <View
                pointerEvents="none"
                className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full"
                style={{ backgroundColor: 'rgba(245, 185, 66, 0.10)' }}
              />
              <View className="h-1.5 w-full" style={gradientStyle(gradients.gold, 90)} />
              <View className="p-5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="h-8 w-8 items-center justify-center rounded-lg"
                      style={gradientStyle(gradients.gold, 135)}
                    >
                      <Icon name="shield-checkmark" size={16} color={colors.ink} />
                    </View>
                    <View>
                      <RNText className="font-extrabold text-[15px] tracking-tight text-white">
                        KBS Solutions
                      </RNText>
                      <RNText className="font-medium text-[10px] uppercase tracking-[1.4px] text-white/60">
                        Official ID
                      </RNText>
                    </View>
                  </View>
                  <View
                    className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${active ? 'bg-[#1F7A4D]' : 'bg-[#B42318]'}`}
                  >
                    <View className="h-1.5 w-1.5 rounded-full bg-white" />
                    <RNText className="font-bold text-[11px] text-white">
                      {active ? `Active · v${card.version}` : 'Revoked'}
                    </RNText>
                  </View>
                </View>

                <View className="mt-6 items-center">
                  <View className="rounded-full p-1" style={gradientStyle(gradients.gold, 135)}>
                    <Avatar name={card.fields.fullName ?? 'KBS'} size={84} />
                  </View>
                  <RNText
                    numberOfLines={2}
                    className="mt-3 text-center font-extrabold text-[24px] tracking-tight text-white"
                  >
                    {card.fields.fullName}
                  </RNText>
                  <RNText className="mt-0.5 font-semibold text-[14px] text-gold">
                    {card.fields.role ?? 'Telecaller'}
                  </RNText>
                </View>

                <View className="mt-5 flex-row items-end gap-4 rounded-2xl bg-white/[0.08] p-3.5">
                  <View className="flex-1 gap-2.5">
                    {card.fields.employeeCode ? (
                      <Field label="Employee code" value={card.fields.employeeCode} mono />
                    ) : null}
                    {card.fields.publicRef ? (
                      <Field label="Public ref" value={card.fields.publicRef} mono />
                    ) : null}
                    <Field
                      label="Issued"
                      value={card.fields.issuedAt ? formatDate(card.fields.issuedAt) : '—'}
                    />
                  </View>
                  {card.svg ? (
                    <View className="items-center gap-1">
                      <View className="rounded-xl bg-white p-1.5">
                        <QrFromSvg svg={card.svg} size={92} />
                      </View>
                      <RNText className="font-medium text-[9px] uppercase tracking-[1px] text-white/60">
                        Scan to verify
                      </RNText>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </Appear>

          {card.verifyUrl ? (
            <Appear index={1}>
              <Card className="flex-row items-start gap-3">
                <IconCircle icon="shield-checkmark-outline" tone="success" size={40} />
                <View className="flex-1 gap-0.5">
                  <Text className="font-bold text-[15px]">Verify</Text>
                  <Muted selectable className="text-[12px] leading-[18px]">
                    Customers can verify at {card.verifyUrl}
                  </Muted>
                </View>
              </Card>
            </Appear>
          ) : null}

          <Appear index={2}>
            <Callout kind="neutral" icon="lock-closed">
              This card carries no customer, PAN or payout data. Share it from a customer record so
              the share is logged.
            </Callout>
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}
