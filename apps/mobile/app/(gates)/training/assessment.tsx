import { ApiClientError } from '@kbs/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { training, type AttemptResult, type AttemptStart } from '@/lib/training';
import { useSession } from '@/lib/session';

/** F-203: MCQ assessment and result (REQ-25 §25.2 "MCQ result"). */
export default function AssessmentScreen() {
  const { seq } = useLocalSearchParams<{ seq: string }>();
  const sequence = Number(seq);
  const { refresh } = useSession();
  const [attempt, setAttempt] = useState<AttemptStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    training
      .start(sequence)
      .then(setAttempt)
      .catch((e) => setError(e instanceof ApiClientError ? e.message : 'Could not start the assessment.'));
  }, [sequence]);

  const answered = attempt ? attempt.questions.filter((q) => answers[q.id]).length : 0;

  function confirmSubmit() {
    if (!attempt) return;
    Alert.alert('Submit answers?', `${answered} of ${attempt.questions.length} answered. Unanswered questions count as wrong.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: () => void submit() },
    ]);
  }

  async function submit() {
    if (!attempt) return;
    setBusy(true);
    try {
      const r = await training.submit(attempt.attemptId, answers);
      setResult(r);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not submit.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Screen>
        <View className="gap-4">
          <Heading>{result.passed ? 'Passed' : 'Not passed'}</Heading>
          <Card className="gap-1">
            <Text className="text-3xl font-semibold">{result.scorePct}%</Text>
            <Muted>
              {result.correct} of {result.total} correct · pass mark {result.passThresholdPct}%
            </Muted>
          </Card>
          {result.allModulesPassed ? (
            <>
              <Text>You have passed all three modules. Your calling queue is now available.</Text>
              <Button title="Continue" onPress={() => router.replace('/')} />
            </>
          ) : result.passed && result.nextModuleSequence ? (
            <Button title={`Go to Module ${result.nextModuleSequence}`} onPress={() => router.replace({ pathname: '/(gates)/training/module', params: { seq: String(result.nextModuleSequence) } })} />
          ) : result.deadlinePassed ? (
            <Text>Your training window has ended. Ask your Manager to reactivate your training.</Text>
          ) : result.retryAvailable ? (
            <Button title="Try again" onPress={() => router.replace({ pathname: '/(gates)/training/module', params: { seq: String(sequence) } })} />
          ) : (
            <Text>No attempts left for this module. Contact your Manager.</Text>
          )}
          <Button title="Back to training" variant="ghost" onPress={() => router.replace('/(gates)/training')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-10">
        <Heading>Module {sequence} assessment</Heading>
        <ErrorText>{error}</ErrorText>
        {attempt?.questions.map((q, i) => (
          <Card key={q.id} className="gap-2">
            <Text className="font-medium">
              {i + 1}. {q.text}
            </Text>
            {q.options.map((o) => {
              const selected = answers[q.id] === o.key;
              return (
                <Pressable
                  key={o.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                  className={`flex-row items-center gap-3 rounded-md border px-3 py-3 ${selected ? 'border-primary bg-accent' : 'border-border'}`}
                >
                  <Text className="w-5 font-mono">{o.key}</Text>
                  <Text className="flex-1">{o.text}</Text>
                </Pressable>
              );
            })}
          </Card>
        ))}
        {attempt ? (
          <>
            <Muted>
              {answered} of {attempt.questions.length} answered
            </Muted>
            <Button title={busy ? 'Submitting…' : 'Submit answers'} disabled={busy} onPress={confirmSubmit} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
