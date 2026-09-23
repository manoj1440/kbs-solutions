import { ApiClientError, formatDateTime } from '@kbs/shared';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import {
  Appear,
  Badge,
  Button,
  Card,
  ErrorState,
  HeroHeader,
  Icon,
  type IconName,
  Muted,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  StickyFooter,
  Text,
} from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';
import { countdown, training, type TrainingMe, type TrainingModuleState } from '@/lib/training';

const ICONS: IconName[] = ['card', 'business', 'document-text', 'people', 'create'];

function TimelineNode({ state, index }: { state: 'done' | 'current' | 'locked'; index: number }) {
  if (state === 'done') {
    return (
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={gradientStyle(gradients.success, 135)}
      >
        <Icon name="checkmark" size={20} color="#fff" />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={[
          gradientStyle(['#16329E', '#3D5AFE'], 135),
          shadow.glow,
          { boxShadow: '0px 0px 0px 5px rgba(22, 50, 158, 0.14)' },
        ]}
      >
        <Icon name={ICONS[index % ICONS.length]!} size={18} color="#fff" />
      </View>
    );
  }
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-line bg-[#EEF0F4]">
      <Icon name="lock-closed" size={16} color={colors.subtle} />
    </View>
  );
}

function ModuleRow({
  m,
  i,
  last,
  canOpen,
}: {
  m: TrainingModuleState;
  i: number;
  last: boolean;
  canOpen: boolean;
}) {
  const locked = m.status === 'LOCKED';
  const passed = m.status === 'PASSED';
  const state = passed ? 'done' : locked ? 'locked' : 'current';
  return (
    <View className="flex-row gap-3.5">
      <View className="items-center">
        <TimelineNode state={state} index={i} />
        {!last ? (
          <View
            className={`w-[2px] flex-1 ${passed ? 'bg-[#2FA36B]' : 'bg-line'}`}
            style={{ minHeight: 18 }}
          />
        ) : null}
      </View>
      <View className={`flex-1 ${last ? '' : 'pb-4'}`}>
        <Card
          variant={state === 'current' ? 'outline' : 'elevated'}
          className={`gap-2 p-4 ${locked ? 'opacity-70' : ''}`}
          style={state === 'current' ? [shadow.md, { borderColor: colors.brand }] : undefined}
        >
          <View className="flex-row items-center justify-between gap-2">
            <RNText className="font-semibold text-[11px] uppercase tracking-[1.2px] text-[#8A93A6]">
              Module {m.sequence}
            </RNText>
            <Badge
              label={passed ? 'Completed' : locked ? 'Locked' : 'In progress'}
              variant={passed ? 'success' : locked ? 'unknown' : 'default'}
              size="sm"
              dot
            />
          </View>
          <Text className="font-bold text-[16px] leading-[21px]" numberOfLines={2}>
            {m.title}
          </Text>
          <View className="flex-row flex-wrap gap-x-3 gap-y-1">
            <View className="flex-row items-center gap-1">
              <Icon name="flag-outline" size={13} color={colors.subtle} />
              <Muted className="text-[12px]">pass {m.passThresholdPct}%</Muted>
            </View>
            {m.bestScorePct !== null ? (
              <View className="flex-row items-center gap-1">
                <Icon name="stats-chart-outline" size={13} color={colors.subtle} />
                <Muted className="text-[12px]">best {m.bestScorePct}%</Muted>
              </View>
            ) : null}
            {m.attemptsRemaining !== null ? (
              <View className="flex-row items-center gap-1">
                <Icon name="repeat-outline" size={13} color={colors.subtle} />
                <Muted className="text-[12px]">{m.attemptsRemaining} left</Muted>
              </View>
            ) : null}
          </View>
          {!m.published ? (
            <View className="flex-row items-center gap-1.5 rounded-xl bg-[#FFF3DC] px-2.5 py-1.5">
              <Icon name="information-circle" size={14} color={colors.warning} />
              <RNText className="flex-1 font-medium text-[12px] text-[#7A4A05]">
                Not published yet — contact the Admin.
              </RNText>
            </View>
          ) : null}
          {m.status === 'IN_PROGRESS' && m.published && canOpen ? (
            <Link
              href={{ pathname: '/(gates)/training/module', params: { seq: String(m.sequence) } }}
              asChild
            >
              <Button
                title="Open"
                size="sm"
                variant="secondary"
                iconRight="arrow-forward"
                className="mt-1 self-start"
              />
            </Link>
          ) : null}
        </Card>
      </View>
    </View>
  );
}

/** F-203 / S08 Training landing — progress bar, module states, Continue Learning (REQ-25 §25.2). */
export default function TrainingLanding() {
  const { signOut, refresh } = useSession();
  const [me, setMe] = useState<TrainingMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMe(await training.me());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load training.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const blocked = me?.deadlinePassed || me?.status === 'EXPIRED_DEACTIVATED';
  const reactivatedNoWindow = me?.status === 'REACTIVATED_IN_PROGRESS' && !me.deadlineAt;
  const modules = me?.modules ?? [];
  const done = modules.filter((m) => m.status === 'PASSED').length;
  const pct = modules.length ? Math.round((done / modules.length) * 100) : 0;
  const current = modules.find((m) => m.status === 'IN_PROGRESS' && m.published);
  const canOpen = !blocked && !reactivatedNoWindow;

  return (
    <Screen
      inset="none"
      statusBar="light"
      scroll
      padded={false}
      contentClassName="pt-0"
      footer={
        current && canOpen ? (
          <StickyFooter>
            <Link
              href={{
                pathname: '/(gates)/training/module',
                params: { seq: String(current.sequence) },
              }}
              asChild
            >
              <Button title="Continue Learning" size="lg" icon="play" />
            </Link>
          </StickyFooter>
        ) : null
      }
    >
      <HeroHeader className="pb-16">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-white/15">
            <Icon name="school" size={17} color={colors.gold} />
          </View>
          <RNText className="font-semibold text-[12px] uppercase tracking-[1.4px] text-white/70">
            Training
          </RNText>
        </View>
        <RNText
          accessibilityRole="header"
          className="mt-4 font-extrabold text-[28px] leading-[34px] tracking-tight text-white"
        >
          Complete Your Training
        </RNText>
        <RNText className="mt-1 font-medium text-[14px] text-white/70">
          Learn · Understand · Start Earning
        </RNText>
        {me?.deadlineAt ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <Icon name="time-outline" size={14} color={colors.gold} />
              <RNText className="font-bold text-[12px] text-white">
                {countdown(me.deadlineAt)}
              </RNText>
            </View>
            <RNText className="font-medium text-[12px] text-white/60">
              Deadline {formatDateTime(me.deadlineAt)}
            </RNText>
          </View>
        ) : null}
      </HeroHeader>

      <View className="-mt-10 gap-5 px-4">
        <Appear>
          <View className="rounded-3xl bg-white p-4" style={shadow.lg}>
            {me ? (
              <>
                <View className="flex-row items-end justify-between">
                  <View>
                    <RNText className="font-semibold text-[11px] uppercase tracking-[1.2px] text-[#8A93A6]">
                      Overall progress
                    </RNText>
                    <RNText className="mt-1 font-bold text-[15px] text-ink">
                      {done}/{modules.length} modules completed
                    </RNText>
                  </View>
                  <RNText className="font-extrabold text-[28px] tracking-tight text-brand">
                    {pct}%
                  </RNText>
                </View>
                <View className="mt-3">
                  <ProgressBar
                    value={pct / 100}
                    tone={pct === 100 ? 'success' : 'default'}
                    height={10}
                  />
                </View>
              </>
            ) : error ? (
              <Muted>Progress unavailable.</Muted>
            ) : (
              <View className="gap-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2.5 w-full" />
              </View>
            )}
          </View>
        </Appear>

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {blocked ? (
          <Appear index={1}>
            <Card className="gap-2">
              <Badge label="Training window ended" variant="destructive" icon="alert-circle" />
              <Text className="text-[14px] leading-[21px]">
                Your 72-hour window has ended. Ask your Manager to reactivate your training — you
                will resume at the first module you have not passed.
              </Text>
            </Card>
          </Appear>
        ) : null}
        {reactivatedNoWindow ? (
          <Appear index={1}>
            <Card className="gap-2">
              <Badge label="Waiting for Admin" variant="warning" icon="hourglass-outline" />
              <Text className="text-[14px] leading-[21px]">
                Training was reactivated but the new window is not configured yet. Contact the
                Admin.
              </Text>
            </Card>
          </Appear>
        ) : null}
        {me?.status === 'PASSED' ? (
          <Appear index={1}>
            <Card className="gap-3">
              <View className="flex-row items-center gap-3">
                <View
                  className="h-11 w-11 items-center justify-center rounded-2xl"
                  style={gradientStyle(gradients.success, 135)}
                >
                  <Icon name="trophy" size={22} color="#fff" />
                </View>
                <View className="flex-1 gap-1">
                  <Badge label="All modules passed" variant="success" />
                  <Text className="text-[14px]">Your calling queue is available.</Text>
                </View>
              </View>
              <Button
                title="Go to my queue"
                iconRight="arrow-forward"
                onPress={() => void refresh()}
              />
            </Card>
          </Appear>
        ) : null}

        {modules.length || !me ? (
          <Appear index={2} className="gap-3">
            <SectionHeader title="Your modules" />
            {!me && !error ? (
              <View className="gap-4">
                {[0, 1, 2].map((i) => (
                  <View key={i} className="flex-row gap-3.5">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-24 flex-1 rounded-2xl" />
                  </View>
                ))}
              </View>
            ) : (
              <View>
                {modules.map((m, i) => (
                  <ModuleRow
                    key={m.sequence}
                    m={m}
                    i={i}
                    last={i === modules.length - 1}
                    canOpen={canOpen}
                  />
                ))}
              </View>
            )}
          </Appear>
        ) : null}

        <Button
          title="Sign out"
          variant="ghost"
          icon="log-out-outline"
          onPress={() => void signOut()}
        />
      </View>
    </Screen>
  );
}
