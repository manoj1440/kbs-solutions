import { ApiClientError } from '@kbs/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
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
        void training.videoProgress(sequence, position, duration, true).then(() => setVideoDone(true));
      }
    });
    const ended = player.addListener('playToEnd', () => {
      if (!reported.current) {
        reported.current = true;
        void training.videoProgress(sequence, player.duration, player.duration, true).then(() => setVideoDone(true));
      }
    });
    return () => {
      sub.remove();
      ended.remove();
    };
  }, [player, videoUrl, sequence]);

  const canStart = mod?.published && (videoDone || !mod?.videoFileId) && (mod?.attemptsRemaining === null || (mod?.attemptsRemaining ?? 0) > 0);

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-10">
        <Heading>
          Module {sequence}
          {mod ? `: ${mod.title}` : ''}
        </Heading>
        <ErrorText>{error}</ErrorText>
        {videoUrl ? (
          <Card className="gap-2">
            <VideoView player={player} style={{ width: '100%', aspectRatio: 16 / 9 }} nativeControls />
            <Muted>{videoDone ? 'Video completed.' : 'Watch the whole video to unlock the assessment.'}</Muted>
          </Card>
        ) : mod && !mod.videoFileId ? (
          <Muted>No video for this module.</Muted>
        ) : null}
        {mod?.materialText ? (
          <Card>
            <Text>{mod.materialText}</Text>
          </Card>
        ) : null}
        <Card className="gap-2">
          <Text className="font-medium">Assessment</Text>
          <Muted>
            Pass mark {mod?.passThresholdPct ?? '—'}%{mod?.attemptsRemaining !== null && mod ? ` · ${mod.attemptsRemaining} attempts left` : ''}
          </Muted>
          <Button title="Start assessment" disabled={!canStart} onPress={() => router.push({ pathname: '/(gates)/training/assessment', params: { seq: String(sequence) } })} />
        </Card>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
