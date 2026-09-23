import { ApiClientError } from '@kbs/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import {
  AppBar,
  Appear,
  Badge,
  Button,
  Card,
  ErrorText,
  Icon,
  IconCircle,
  Muted,
  Screen,
  Skeleton,
  StickyFooter,
  Text,
} from '@/components/ui';
import { colors } from '@/lib/theme';
import { training, type TrainingModuleState } from '@/lib/training';

/** F-203: Module learning — video with progress reporting, material, then the assessment. */
export default function ModuleScreen() {
  const { seq } = useLocalSearchParams<{ seq: string }>();
  const sequence = Number(seq);
  const [mod, setMod] = useState<TrainingModuleState | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoDone, setVideoDone] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await training.me();
        const m = me.modules.find((x) => x.sequence === sequence) ?? null;
        setMod(m);
        setVideoDone(Boolean(m?.videoCompletedAt));
        if (m?.videoFileId) setVideoUrl(await training.fileUrl(m.videoFileId));
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : 'Could not load the module.');
      }
    })();
  }, [sequence]);

  const player = useVideoPlayer(videoUrl ?? '', (p) => {
    p.timeUpdateEventInterval = 5;
  });

  useEffect(() => {
    if (!videoUrl) return;
    const sub = player.addListener('timeUpdate', (ev) => {
      const duration = player.duration || undefined;
      const position = ev.currentTime;
      const complete = Boolean(duration) && position >= (duration as number) * 0.95;
      if (complete && !reported.current) {
        reported.current = true;
        void training
          .videoProgress(sequence, position, duration, true)
          .then(() => setVideoDone(true));
      }
    });
    const ended = player.addListener('playToEnd', () => {
      if (!reported.current) {
        reported.current = true;
        void training
          .videoProgress(sequence, player.duration, player.duration, true)
          .then(() => setVideoDone(true));
      }
    });
    return () => {
      sub.remove();
      ended.remove();
    };
  }, [player, videoUrl, sequence]);

  const canStart =
    mod?.published &&
    (videoDone || !mod?.videoFileId) &&
    (mod?.attemptsRemaining === null || (mod?.attemptsRemaining ?? 0) > 0);

  return (
    <Screen
      scroll
      header={<AppBar title={`Module ${sequence}`} subtitle="Training" />}
      footer={
        <StickyFooter>
          <Button
            title="Start assessment"
            size="lg"
            icon="clipboard-outline"
            disabled={!canStart}
            onPress={() =>
              router.push({
                pathname: '/(gates)/training/assessment',
                params: { seq: String(sequence) },
              })
            }
          />
        </StickyFooter>
      }
    >
      <Appear>
        {mod ? (
          <RNText
            accessibilityRole="header"
            className="font-extrabold text-[24px] leading-[30px] tracking-tight text-ink"
          >
            {mod.title}
          </RNText>
        ) : !error ? (
          <Skeleton className="mt-2 h-7 w-2/3" />
        ) : null}
      </Appear>
      <ErrorText>{error}</ErrorText>

      {videoUrl ? (
        <Appear index={1}>
          <View className="overflow-hidden rounded-3xl bg-ink">
            <VideoView
              player={player}
              style={{ width: '100%', aspectRatio: 16 / 9 }}
              nativeControls
            />
            <View className="flex-row items-center gap-2 px-4 py-3">
              <Icon
                name={videoDone ? 'checkmark-circle' : 'play-circle-outline'}
                size={18}
                color={videoDone ? '#4ADE80' : colors.gold}
              />
              <RNText className="flex-1 font-medium text-[13px] text-white/85">
                {videoDone ? 'Video completed.' : 'Watch the whole video to unlock the assessment.'}
              </RNText>
            </View>
          </View>
        </Appear>
      ) : mod && !mod.videoFileId ? (
        <Appear index={1}>
          <Card variant="tinted" className="flex-row items-center gap-3">
            <IconCircle icon="videocam-off-outline" tone="secondary" size={36} />
            <Muted className="flex-1">No video for this module.</Muted>
          </Card>
        </Appear>
      ) : !mod && !error ? (
        <Skeleton className="h-48 w-full rounded-3xl" />
      ) : null}

      {mod?.materialText ? (
        <Appear index={2}>
          <Card className="gap-3 p-5">
            <View className="flex-row items-center gap-2.5">
              <IconCircle icon="book-outline" size={34} />
              <RNText className="font-bold text-[16px] text-ink">Study material</RNText>
            </View>
            <Text className="leading-[24px] text-[#374151]">{mod.materialText}</Text>
          </Card>
        </Appear>
      ) : null}

      <Appear index={3}>
        <Card className="gap-3 p-5">
          <View className="flex-row items-center gap-3">
            <IconCircle icon="clipboard" tone="gold" size={40} />
            <View className="flex-1">
              <RNText className="font-bold text-[16px] text-ink">Assessment</RNText>
              <Muted className="text-[12px]">Multiple-choice questions</Muted>
            </View>
            {canStart ? (
              <Badge label="Ready" variant="success" dot size="sm" />
            ) : (
              <Badge label="Locked" variant="unknown" icon="lock-closed" size="sm" />
            )}
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1 rounded-2xl bg-canvas px-3 py-2.5">
              <Muted className="text-[11px]">Pass mark</Muted>
              <RNText className="font-extrabold text-[18px] text-ink">
                {mod?.passThresholdPct ?? '—'}%
              </RNText>
            </View>
            {mod?.attemptsRemaining !== null && mod ? (
              <View className="flex-1 rounded-2xl bg-canvas px-3 py-2.5">
                <Muted className="text-[11px]">Attempts left</Muted>
                <RNText className="font-extrabold text-[18px] text-ink">
                  {mod.attemptsRemaining}
                </RNText>
              </View>
            ) : null}
          </View>
        </Card>
      </Appear>
    </Screen>
  );
}
