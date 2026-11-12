import { ApiClientError } from '@kbs/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text as RNText, View } from 'react-native';

import { StateIcon } from '@/components/auth';
import {
  AppBar,
  Appear,
  Button,
  Card,
  ChoiceRow,
  ErrorText,
  Muted,
  ProgressBar,
  Screen,
  Skeleton,
  StickyFooter,
  Text,
} from '@/components/ui';
import {
  averageRetakeNotice,
  training,
  type AttemptResult,
  type AttemptStart,
} from '@/lib/training';
import { useSession } from '@/lib/session';

/** F-203: MCQ assessment and result (REQ-25 §25.2 "MCQ result"). */
export default function AssessmentScreen() {
  const { seq } = useLocalSearchParams<{ seq: string }>();
  const sequence = Number(seq);
  const { refresh } = useSession();
  const [attempt, setAttempt] = useState<AttemptStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  // average pass rule: set when every module is passed but the average is still short (null under the default rule)
  const [averageNotice, setAverageNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    training
      .start(sequence)
      .then(setAttempt)
      .catch((e) =>
        setError(e instanceof ApiClientError ? e.message : 'Could not start the assessment.'),
      );
  }, [sequence]);

  const answered = attempt ? attempt.questions.filter((q) => answers[q.id]).length : 0;

  function confirmSubmit() {
    if (!attempt) return;
    Alert.alert(
      'Submit answers?',
      `${answered} of ${attempt.questions.length} answered. Unanswered questions count as wrong.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => void submit() },
      ],
    );
  }

  async function submit() {
    if (!attempt) return;
    setBusy(true);
    try {
      const r = await training.submit(attempt.attemptId, answers);
      if (r.canRetakeForAverage) {
        // the averages come from /training/me; if that read fails the notice is shown without the numbers
        const me = await training.me().catch(() => null);
        setAverageNotice(averageRetakeNotice(me ?? { canRetakeForAverage: true }));
      }
      setResult(r);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not submit.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const primary = result.allModulesPassed ? (
      <Button
        title="Continue"
        size="lg"
        iconRight="arrow-forward"
        onPress={() => router.replace('/')}
      />
    ) : result.passed && averageNotice ? null : result.passed && result.nextModuleSequence ? (
      <Button
        title={`Go to Module ${result.nextModuleSequence}`}
        size="lg"
        iconRight="arrow-forward"
        onPress={() =>
          router.replace({
            pathname: '/(gates)/training/module',
            params: { seq: String(result.nextModuleSequence) },
          })
        }
      />
    ) : result.deadlinePassed ? null : result.retryAvailable ? (
      <Button
        title="Try again"
        size="lg"
        icon="refresh"
        onPress={() =>
          router.replace({
            pathname: '/(gates)/training/module',
            params: { seq: String(sequence) },
          })
        }
      />
    ) : null;
    const note = result.allModulesPassed
      ? 'You have passed all three modules. Your calling queue is now available.'
      : averageNotice
        ? averageNotice
        : result.passed && result.nextModuleSequence
          ? null
          : result.deadlinePassed
            ? 'Your training window has ended. Ask your Manager to reactivate your training.'
            : result.retryAvailable
              ? null
              : 'No attempts left for this module. Contact your Manager.';
    return (
      <Screen
        scroll
        header={<AppBar title={`Module ${sequence} result`} back={false} />}
        footer={
          <StickyFooter>
            {primary}
            <Button
              title="Back to training"
              variant="ghost"
              onPress={() => router.replace('/(gates)/training')}
            />
          </StickyFooter>
        }
      >
        <Appear className="items-center pt-6">
          <StateIcon
            icon={result.passed ? 'checkmark' : 'close'}
            tone={result.passed ? 'success' : 'destructive'}
          />
          <RNText
            accessibilityRole="header"
            className="mt-5 text-center font-medium text-2xl text-ink"
          >
            {result.passed ? 'Passed' : 'Not passed'}
          </RNText>
        </Appear>
        <Appear index={1}>
          <Card className="items-center gap-3 p-5">
            <RNText
              className={`font-medium text-3xl tabular-nums ${result.passed ? 'text-[#0F766E]' : 'text-[#B42318]'}`}
            >
              {result.scorePct}%
            </RNText>
            <View
              accessibilityLabel={`Score ${result.scorePct}%, pass mark ${result.passThresholdPct}%`}
              className="w-full py-1"
            >
              <ProgressBar
                value={result.scorePct / 100}
                tone={result.passed ? 'success' : 'default'}
                height={8}
              />
              <View
                pointerEvents="none"
                className="absolute top-0 h-4 w-0.5 bg-ink"
                style={{ left: `${result.passThresholdPct}%`, marginLeft: -1 }}
              />
            </View>
            <Muted className="text-center tabular-nums">
              {result.correct} of {result.total} correct · pass mark {result.passThresholdPct}%
            </Muted>
          </Card>
        </Appear>
        {note ? (
          <Appear index={2}>
            <Card variant={result.allModulesPassed ? 'tinted' : 'flat'} className="p-4">
              <Text className="text-center text-md">{note}</Text>
            </Card>
          </Appear>
        ) : null}
      </Screen>
    );
  }

  const total = attempt?.questions.length ?? 0;
  return (
    <Screen
      scroll
      header={
        <View>
          <AppBar
            title={`Module ${sequence} assessment`}
            subtitle={attempt ? `${answered} of ${total} answered` : 'Loading questions…'}
          />
          <View className="px-4 pb-3">
            <ProgressBar value={total ? answered / total : 0} height={6} />
          </View>
        </View>
      }
      footer={
        attempt ? (
          <StickyFooter>
            <View className="flex-row items-center justify-between">
              <Muted className="font-medium">
                {answered} of {attempt.questions.length} answered
              </Muted>
              {answered < total ? (
                <Muted className="text-xs">Unanswered count as wrong</Muted>
              ) : null}
            </View>
            <Button
              title={busy ? 'Submitting…' : 'Submit answers'}
              size="lg"
              icon="checkmark-done"
              loading={busy}
              disabled={busy}
              onPress={confirmSubmit}
            />
          </StickyFooter>
        ) : null
      }
    >
      <ErrorText>{error}</ErrorText>
      {!attempt && !error ? (
        <View className="gap-4">
          {[0, 1].map((i) => (
            <View key={i} className="gap-3 rounded-2xl bg-white p-4">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </View>
          ))}
        </View>
      ) : null}
      {attempt?.questions.map((q, i) => (
        <Appear key={q.id} index={i}>
          <Card className="gap-3 p-4">
            <View className="flex-row items-center justify-between">
              <RNText className="font-normal text-xs text-[#737373] tabular-nums">
                Question {i + 1} of {attempt.questions.length}
              </RNText>
              {answers[q.id] ? (
                <RNText className="font-medium text-xs text-[#0F766E]">Answered</RNText>
              ) : null}
            </View>
            <Text className="font-medium text-base">
              {i + 1}. {q.text}
            </Text>
            <View className="gap-2">
              {q.options.map((o) => (
                <ChoiceRow
                  key={o.key}
                  label={`${o.key}. ${o.text}`}
                  selected={answers[q.id] === o.key}
                  onPress={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                />
              ))}
            </View>
          </Card>
        </Appear>
      ))}
    </Screen>
  );
}
