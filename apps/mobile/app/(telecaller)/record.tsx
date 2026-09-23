import { ApiClientError, type CallingQueueRow, formatDateTime } from '@kbs/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { CreditCardArt } from '@/components/brand/credit-card-art';
import { CallDesk } from '@/components/call-desk';
import { humanize, TimelineItem } from '@/components/team';
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
  SectionHeader,
  Skeleton,
  SkeletonList,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { type AvailableCardsResponse, fetchCardsForRecord, money } from '@/lib/cards';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';

interface RecordDetail extends CallingQueueRow {
  panLast4: string | null;
  batch: { publicRef: string; uploadedAt: string };
  outcomes: {
    id: string;
    outcome: string;
    remarks: string | null;
    followUpAt: string | null;
    at: string;
    telecaller: { fullName: string };
  }[];
  callAttempts: {
    id: string;
    providerState: string;
    initiatedAt: string;
    durationSec: number | null;
    failureReason: string | null;
  }[];
  interests: { id: string; at: string; card: { name: string; bank: { displayName: string } } }[];
  shareActions: { id: string; kind: string; channel: string; handoffResult: string; at: string }[];
  allocationEvents: { id: string; at: string; reason: string }[];
  remarks: { id: string; text: string; at: string; author: { fullName: string } }[];
}

function HeroChip({
  icon,
  label,
  tone,
}: {
  icon: 'alarm' | 'hand-left' | 'eye-off' | 'ellipse';
  label: string;
  tone?: string;
}) {
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: tone ?? 'rgba(255,255,255,0.15)' }}
    >
      <Icon name={icon} size={icon === 'ellipse' ? 7 : 12} color="#fff" />
      <RNText className="font-semibold text-[12px] text-white">{label}</RNText>
    </View>
  );
}

/** F-307 §3: customer detail + full history trail, with the call desk (F-309/F-310) and cards for the pincode (F-308). */
export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rec, setRec] = useState<RecordDetail | null>(null);
  const [cards, setCards] = useState<AvailableCardsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.get<RecordDetail>(`/calling/records/${id}`);
      setRec(r.data);
      if (!r.data.hiddenAt) setCards((await fetchCardsForRecord(id)).data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load this customer.');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen scroll header={<AppBar title={rec?.fullName ?? 'Customer'} subtitle="Call desk" />}>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!rec && !error ? (
        <View className="gap-3">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <SkeletonList rows={2} />
        </View>
      ) : null}
      {rec ? (
        <>
          <Appear>
            <View
              className="overflow-hidden rounded-3xl p-5"
              style={[gradientStyle(gradients.hero, 140), shadow.lg]}
            >
              <View
                pointerEvents="none"
                className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/[0.07]"
              />
              <View className="flex-row items-center gap-4">
                <Avatar name={rec.fullName} size={58} light />
                <View className="flex-1">
                  <RNText numberOfLines={1} className="font-extrabold text-[21px] text-white">
                    {rec.fullName}
                  </RNText>
                  <RNText className="mt-0.5 font-semibold text-[15px] tracking-wide text-white/90">
                    {rec.mobileMasked}
                  </RNText>
                </View>
              </View>
              <View className="mt-4 gap-1.5 rounded-2xl bg-white/10 p-3">
                <View className="flex-row items-center gap-2">
                  <Icon name="location-outline" size={14} color="rgba(255,255,255,0.75)" />
                  <RNText className="flex-1 font-medium text-[13px] text-white/85">
                    {rec.pincode} · {rec.location}
                  </RNText>
                </View>
                {rec.panLast4 ? (
                  <View className="flex-row items-center gap-2">
                    <Icon name="card-outline" size={14} color="rgba(255,255,255,0.75)" />
                    <RNText className="font-medium text-[13px] text-white/85">
                      PAN ••••••{rec.panLast4}
                    </RNText>
                  </View>
                ) : null}
              </View>
              <View className="mt-3 flex-row flex-wrap gap-2">
                <HeroChip icon="ellipse" label={humanize(rec.interactionStatus)} />
                {rec.suppressed ? (
                  <HeroChip icon="hand-left" label="Do not contact" tone="#B42318" />
                ) : null}
                {rec.hiddenAt ? <HeroChip icon="eye-off" label="Hidden" /> : null}
                {rec.nextFollowUpAt ? (
                  <HeroChip
                    icon="alarm"
                    label={`Follow up ${formatDateTime(rec.nextFollowUpAt)}`}
                    tone="rgba(245, 185, 66, 0.35)"
                  />
                ) : null}
              </View>
            </View>
          </Appear>

          <Appear index={1}>
            {!rec.hiddenAt ? (
              <CallDesk
                recordId={rec.id}
                canCall={rec.canCall}
                cards={cards?.cards ?? []}
                onChanged={load}
              />
            ) : (
              <Callout
                kind={rec.suppressed ? 'danger' : 'neutral'}
                icon={rec.suppressed ? 'hand-left' : 'eye-off'}
              >
                {rec.suppressed
                  ? 'This customer asked not to be contacted.'
                  : 'This record is hidden (read-only history).'}
              </Callout>
            )}
          </Appear>

          {!rec.hiddenAt ? (
            <Appear index={2} className="gap-3">
              <SectionHeader title={`Cards for pincode ${rec.pincode}`} />
              {cards === null ? <SkeletonList rows={2} /> : null}
              {cards?.message ? <Callout kind="info">{cards.message}</Callout> : null}
              {cards?.cards.map((c) => (
                <Card
                  key={c.id}
                  accessibilityLabel={`Open ${c.bank.displayName} ${c.name}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(telecaller)/card',
                      params: { card: JSON.stringify(c), recordId: rec.id },
                    })
                  }
                  className="flex-row items-center gap-3"
                >
                  <CreditCardArt bank={c.bank.displayName} width={84} compact />
                  <View className="flex-1 gap-0.5">
                    <Text numberOfLines={1} className="font-bold text-[15px]">
                      {c.name}
                    </Text>
                    <Muted numberOfLines={1} className="text-[12px]">
                      {c.bank.displayName} ·{' '}
                      {c.categories.map((x) => x.label).join(', ') || 'uncategorised'}
                    </Muted>
                    <Muted numberOfLines={1} className="text-[12px]">
                      joining {money(c.joiningFee)} · annual {money(c.annualFee)}
                    </Muted>
                    {c.benefits[0] ? (
                      <Muted numberOfLines={1} className="text-[12px] text-[#1F6B45]">
                        • {c.benefits[0]}
                      </Muted>
                    ) : null}
                  </View>
                  <Icon name="chevron-forward" size={16} color={colors.subtle} />
                </Card>
              ))}
              {cards ? (
                <Muted className="text-center text-[11px]">
                  As of {formatDateTime(cards.asOf)} · from current uploaded bank data
                </Muted>
              ) : null}
            </Appear>
          ) : null}

          <Appear index={3} className="gap-3">
            <SectionHeader title="Outcomes" />
            <Card>
              {rec.outcomes.length === 0 ? (
                <View className="flex-row items-center gap-3">
                  <Icon name="time-outline" size={18} color={colors.subtle} />
                  <Muted>No calls logged yet.</Muted>
                </View>
              ) : null}
              {rec.outcomes.map((o, i) => (
                <TimelineItem
                  key={o.id}
                  icon="create-outline"
                  tone="info"
                  last={i === rec.outcomes.length - 1}
                  title={`${o.outcome.replace('_', ' ')}${o.remarks ? ` — ${o.remarks}` : ''}`}
                  meta={`${formatDateTime(o.at)} · ${o.telecaller.fullName}${o.followUpAt ? ` · follow-up ${formatDateTime(o.followUpAt)}` : ''}`}
                />
              ))}
            </Card>
          </Appear>

          {rec.callAttempts.length ? (
            <Appear index={4} className="gap-3">
              <SectionHeader title="Call attempts" />
              <Card>
                {rec.callAttempts.map((c, i) => (
                  <TimelineItem
                    key={c.id}
                    icon="call-outline"
                    tone="secondary"
                    last={i === rec.callAttempts.length - 1}
                    title={humanize(c.providerState)}
                    meta={`${formatDateTime(c.initiatedAt)}${c.durationSec ? ` · ${c.durationSec}s` : ''}${c.failureReason ? ` · ${c.failureReason}` : ''}`}
                  />
                ))}
              </Card>
            </Appear>
          ) : null}

          {rec.interests.length || rec.shareActions.length ? (
            <Appear index={5} className="gap-3">
              <SectionHeader title="Cards & shares" />
              <Card>
                {rec.interests.map((it, i) => (
                  <TimelineItem
                    key={it.id}
                    icon="heart-outline"
                    tone="gold"
                    last={i === rec.interests.length - 1 && rec.shareActions.length === 0}
                    title={`Interested: ${it.card.bank.displayName} ${it.card.name}`}
                    meta={formatDateTime(it.at)}
                  />
                ))}
                {rec.shareActions.map((s, i) => (
                  <TimelineItem
                    key={s.id}
                    icon="share-social-outline"
                    tone="success"
                    last={i === rec.shareActions.length - 1}
                    title={`${s.kind} via ${s.channel}`}
                    meta={`${s.handoffResult.toLowerCase()} · ${formatDateTime(s.at)}`}
                  />
                ))}
              </Card>
            </Appear>
          ) : null}

          <Appear index={6} className="gap-3">
            <SectionHeader title="Assignment history" />
            <Card>
              {rec.allocationEvents.map((e) => (
                <TimelineItem
                  key={e.id}
                  icon="swap-horizontal"
                  tone="secondary"
                  title={e.reason}
                  meta={formatDateTime(e.at)}
                />
              ))}
              <TimelineItem
                icon="cloud-upload-outline"
                tone="secondary"
                last
                title={`Batch ${rec.batch.publicRef}`}
                meta={`imported ${formatDateTime(rec.batch.uploadedAt)}`}
              />
            </Card>
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}
