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
  Muted,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { colors, shadow } from '@/lib/theme';
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

function Field({ label, value }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="gap-0.5">
      <RNText className="font-normal text-xs text-[#737373]">{label}</RNText>
      <RNText numberOfLines={1} className="font-medium text-sm text-ink tabular-nums">
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
    <Screen scroll header={<AppBar back={false} large title="Official ID" />}>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!card && !error ? <Skeleton className="h-96 w-full rounded-2xl" /> : null}
      {card ? (
        <>
          <Appear>
            {/* the ID badge: a flat white card with a hairline and a thin KBS-orange band */}
            <View
              className="overflow-hidden rounded-2xl border border-line bg-white"
              style={shadow.lg}
            >
              <View
                className="h-1 w-full"
                style={{ backgroundColor: active ? colors.orange : colors.subtle }}
              />
              <View className="p-5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: colors.orange }}
                    >
                      <Icon name="shield-checkmark-outline" size={16} color={colors.ink} />
                    </View>
                    <View>
                      <RNText className="font-medium text-base text-ink">KBS Solutions</RNText>
                      <RNText className="font-normal text-xs text-[#737373]">Official ID</RNText>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: active ? colors.success : colors.danger }}
                    />
                    <RNText
                      className="font-medium text-xs tabular-nums"
                      style={{ color: active ? colors.success : colors.danger }}
                    >
                      {active ? `Active · v${card.version}` : 'Revoked'}
                    </RNText>
                  </View>
                </View>

                <View className="mt-6 items-center">
                  <Avatar name={card.fields.fullName ?? 'KBS'} size={72} />
                  <RNText
                    numberOfLines={2}
                    className="mt-3 text-center font-medium text-xl text-ink"
                  >
                    {card.fields.fullName}
                  </RNText>
                  <RNText className="mt-0.5 font-normal text-md text-[#525252]">
                    {card.fields.role ?? 'Telecaller'}
                  </RNText>
                </View>

                <View className="mt-5 flex-row items-end gap-4 rounded-xl bg-raised p-3">
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
                      <View className="rounded-lg border border-line bg-white p-1.5">
                        <QrFromSvg svg={card.svg} size={92} />
                      </View>
                      <RNText className="font-normal text-xs text-[#737373]">Scan to verify</RNText>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </Appear>

          {card.verifyUrl ? (
            <Appear index={1}>
              <Card>
                <View className="gap-0.5">
                  <Text className="font-medium text-base">Verify</Text>
                  <Muted selectable className="text-xs">
                    Customers can verify at {card.verifyUrl}
                  </Muted>
                </View>
              </Card>
            </Appear>
          ) : null}

          <Appear index={2}>
            <Callout kind="neutral" icon="lock-closed-outline">
              This card carries no customer, PAN or payout data. Share it from a customer record so
              the share is logged.
            </Callout>
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}
