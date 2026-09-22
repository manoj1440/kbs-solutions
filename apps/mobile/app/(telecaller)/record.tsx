import { ApiClientError, type CallingQueueRow, formatDateTime } from '@kbs/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { SecureScreen } from '@/components/secure-screen';
import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface RecordDetail extends CallingQueueRow {
  panLast4: string | null;
  batch: { publicRef: string; uploadedAt: string };
  outcomes: { id: string; outcome: string; remarks: string | null; followUpAt: string | null; at: string; telecaller: { fullName: string } }[];
  callAttempts: { id: string; providerState: string; initiatedAt: string; durationSec: number | null; failureReason: string | null }[];
  interests: { id: string; at: string; card: { name: string; bank: { displayName: string } } }[];
  shareActions: { id: string; kind: string; channel: string; handoffResult: string; at: string }[];
  allocationEvents: { id: string; at: string; reason: string }[];
  remarks: { id: string; text: string; at: string; author: { fullName: string } }[];
}

/** F-307 §3: customer detail + full history trail. Call / outcome / share actions arrive with F-309/F-310/F-311. */
export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rec, setRec] = useState<RecordDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.get<RecordDetail>(`/calling/records/${id}`);
      setRec(r.data);
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
    <SecureScreen>
      <Screen>
        <ScrollView contentContainerClassName="gap-3 pb-8">
          <Button title="← Back to queue" variant="ghost" onPress={() => router.back()} />
          <ErrorText>{error}</ErrorText>
          {rec ? (
            <>
              <View>
                <Heading>{rec.fullName}</Heading>
                <Muted>
                  {rec.mobileMasked} · {rec.pincode} · {rec.location}
                </Muted>
                {rec.panLast4 ? <Muted>PAN ••••••{rec.panLast4}</Muted> : null}
                <View className="mt-2 flex-row flex-wrap gap-2">
                  <Badge label={rec.interactionStatus.replace('_', ' ')} variant="secondary" />
                  {rec.suppressed ? <Badge label="Do not contact" variant="destructive" /> : null}
                  {rec.hiddenAt ? <Badge label="Hidden" variant="unknown" /> : null}
                  {rec.nextFollowUpAt ? <Badge label={`Follow up ${formatDateTime(rec.nextFollowUpAt)}`} variant="warning" /> : null}
                </View>
              </View>
              <Card className="gap-2">
                <Text className="font-medium">Actions</Text>
                <Button title={rec.canCall ? 'Call customer' : 'Calling not available'} disabled />
                <Muted>{rec.canCall ? 'Calling, outcomes and card sharing are enabled in the next release of this app.' : rec.suppressed ? 'This customer asked not to be contacted.' : 'This record is hidden (read-only history).'}</Muted>
              </Card>
              <Card className="gap-1">
                <Text className="font-medium">Outcomes</Text>
                {rec.outcomes.length === 0 ? <Muted>No calls logged yet.</Muted> : null}
                {rec.outcomes.map((o) => (
                  <View key={o.id} className="border-b border-border py-1">
                    <Text>{o.outcome.replace('_', ' ')}{o.remarks ? ` — ${o.remarks}` : ''}</Text>
                    <Muted>
                      {formatDateTime(o.at)} · {o.telecaller.fullName}
                      {o.followUpAt ? ` · follow-up ${formatDateTime(o.followUpAt)}` : ''}
                    </Muted>
                  </View>
                ))}
              </Card>
              {rec.callAttempts.length ? (
                <Card className="gap-1">
                  <Text className="font-medium">Call attempts</Text>
                  {rec.callAttempts.map((c) => (
                    <Muted key={c.id}>
                      {formatDateTime(c.initiatedAt)} · {c.providerState.toLowerCase()}
                      {c.durationSec ? ` · ${c.durationSec}s` : ''}
                      {c.failureReason ? ` · ${c.failureReason}` : ''}
                    </Muted>
                  ))}
                </Card>
              ) : null}
              {rec.interests.length || rec.shareActions.length ? (
                <Card className="gap-1">
                  <Text className="font-medium">Cards & shares</Text>
                  {rec.interests.map((i) => (
                    <Muted key={i.id}>
                      Interested: {i.card.bank.displayName} {i.card.name} · {formatDateTime(i.at)}
                    </Muted>
                  ))}
                  {rec.shareActions.map((s) => (
                    <Muted key={s.id}>
                      {s.kind} via {s.channel} · {s.handoffResult.toLowerCase()} · {formatDateTime(s.at)}
                    </Muted>
                  ))}
                </Card>
              ) : null}
              <Card className="gap-1">
                <Text className="font-medium">Assignment history</Text>
                {rec.allocationEvents.map((e) => (
                  <Muted key={e.id}>
                    {formatDateTime(e.at)} · {e.reason}
                  </Muted>
                ))}
                <Muted>Batch {rec.batch.publicRef} · imported {formatDateTime(rec.batch.uploadedAt)}</Muted>
              </Card>
            </>
          ) : null}
        </ScrollView>
      </Screen>
    </SecureScreen>
  );
}
