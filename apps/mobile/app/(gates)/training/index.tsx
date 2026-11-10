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
  Muted,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  StickyFooter,
  Text,
} from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import { countdown, training, type TrainingMe, type TrainingModuleState } from '@/lib/training';

/** Timeline node: a status dot with the module number — done (check), current (ink ring) or locked. */
function TimelineNode({ state, index }: { state: 'done' | 'current' | 'locked'; index: number }) {
  if (state === 'done') {
    return (
      <View className="h-8 w-8 items-center justify-center rounded-full bg-[#E6F4F2]">
        <Icon name="checkmark" size={16} color={colors.success} />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white">
        <RNText className="font-medium text-sm text-ink tabular-nums">{index + 1}</RNText>
      </View>
    );
  }
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full border border-line bg-raised">
      <Icon name="lock-closed-outline" size={16} color={colors.subtle} />
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
            className={`w-0.5 flex-1 ${passed ? 'bg-[#0F766E]' : 'bg-[#EBEBEB]'}`}
            style={{ minHeight: 18 }}
          />
        ) : null}
      </View>
      <View className={`flex-1 ${last ? '' : 'pb-4'}`}>
        <Card
          variant={state === 'current' ? 'outline' : 'elevated'}
          className={`gap-2 p-4 ${locked ? 'opacity-70' : ''}`}
          style={state === 'current' ? { borderColor: colors.ink } : undefined}
        >
          <View className="flex-row items-center justify-between gap-2">
            <RNText className="font-normal text-xs text-[#737373] tabular-nums">
              Module {m.sequence}
            </RNText>
            <Badge
              label={passed ? 'Completed' : locked ? 'Locked' : 'In progress'}
              variant={passed ? 'success' : locked ? 'unknown' : 'default'}
              size="sm"
              dot
            />
          </View>
          <Text className="font-medium text-base" numberOfLines={2}>
            {m.title}
          </Text>
          <View className="flex-row flex-wrap gap-x-3 gap-y-1">
            <View className="flex-row items-center gap-1">
              <Icon name="flag-outline" size={16} color={colors.subtle} />
              <Muted className="text-xs">pass {m.passThresholdPct}%</Muted>
            </View>
            {m.bestScorePct !== null ? (
              <View className="flex-row items-center gap-1">
                <Icon name="stats-chart-outline" size={16} color={colors.subtle} />
                <Muted className="text-xs">best {m.bestScorePct}%</Muted>
              </View>
            ) : null}
            {m.attemptsRemaining !== null ? (
              <View className="flex-row items-center gap-1">
                <Icon name="repeat-outline" size={16} color={colors.subtle} />
                <Muted className="text-xs">{m.attemptsRemaining} left</Muted>
              </View>
            ) : null}
          </View>
          {!m.published ? (
            <View className="flex-row items-center gap-1.5 rounded-lg bg-[#FDF4E3] px-2.5 py-1.5">
              <Icon name="information-circle-outline" size={16} color={colors.warning} />
              <RNText className="flex-1 font-normal text-xs text-[#92580A]">
                Not published yet — contact the Admin
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
      statusBar="dark"
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
              <Button title="Continue learning" size="lg" icon="play-outline" />
            </Link>
          </StickyFooter>
        ) : null
      }
    >
      <HeroHeader className="pb-5">
        <RNText accessibilityRole="header" className="mt-2 font-medium text-2xl text-ink">
          Training
        </RNText>
        <RNText className="mt-1 font-normal text-md text-[#525252]">
          Pass every module to start calling
        </RNText>
        {me?.deadlineAt ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-1.5">
              <Icon name="time-outline" size={16} color={colors.gold} />
              <RNText className="font-medium text-sm text-gold tabular-nums">
                {countdown(me.deadlineAt)}
              </RNText>
            </View>
            <RNText className="font-normal text-xs text-[#737373] tabular-nums">
              Deadline {formatDateTime(me.deadlineAt)}
            </RNText>
          </View>
        ) : null}
      </HeroHeader>

      <View className="mt-5 gap-6 px-4">
        <Appear>
          <View className="rounded-xl border border-line bg-white p-4">
            {me ? (
              <>
                <View className="flex-row items-end justify-between">
                  <View>
                    <RNText className="font-normal text-sm text-[#525252]">Overall progress</RNText>
                    <RNText className="mt-1 font-medium text-base text-ink tabular-nums">
                      {done}/{modules.length} modules completed
                    </RNText>
                  </View>
                  <RNText className="font-medium text-2xl text-ink tabular-nums">{pct}%</RNText>
                </View>
                <View className="mt-3">
                  <ProgressBar
                    value={pct / 100}
                    tone={pct === 100 ? 'success' : 'default'}
                    height={6}
                  />
                </View>
              </>
            ) : error ? (
              <Muted>Progress unavailable</Muted>
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
              <Badge
                label="Training window ended"
                variant="destructive"
                icon="alert-circle-outline"
              />
              <Text className="text-md">
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
              <Text className="text-md">
                Training was reactivated but the new window is not configured yet. Contact the
                Admin.
              </Text>
            </Card>
          </Appear>
        ) : null}
        {me?.status === 'PASSED' ? (
          <Appear index={1}>
            <Card className="gap-3">
              <View className="gap-1">
                <Badge label="All modules passed" variant="success" />
                <Text className="text-md">Your calling queue is available</Text>
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
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-24 flex-1 rounded-xl" />
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
