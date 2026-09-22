import { ApiClientError, type AvailableCard, type CallAttemptView, type CallOutcome, formatDateTime, OUTCOME_LABELS, recordingChip } from '@kbs/shared';
import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Input, Label, Muted, Text } from '@/components/ui';
import { api } from '@/lib/api';

const LIVE = new Set(['REQUESTED', 'RINGING', 'CONNECTED']);
const STATE_LABEL: Record<CallAttemptView['providerState'], string> = {
  REQUESTED: 'Requesting connection…',
  RINGING: 'Ringing…',
  CONNECTED: 'Connected',
  ENDED: 'Call ended',
  FAILED: 'Call failed',
  NO_ANSWER: 'No answer',
  UNKNOWN: 'Unknown',
};

function newKey() {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * F-309 §7 / F-310: persistent call control bar + outcome editor on the record screen.
 * One idempotency key per tap; the key is kept until the server answers so a double-tap can never create two attempts.
 */
export function CallDesk({ recordId, canCall, cards, onChanged }: { recordId: string; canCall: boolean; cards: AvailableCard[]; onChanged: () => Promise<void> }) {
  const [call, setCall] = useState<CallAttemptView | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [remarks, setRemarks] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [cardId, setCardId] = useState<string | null>(null);
  const [dnc, setDnc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const live = call !== null && LIVE.has(call.providerState);

  // poll while the call is live (SSE later)
  useEffect(() => {
    if (!call || !LIVE.has(call.providerState)) return;
    const id = setInterval(async () => {
      try {
        const r = await api.get<CallAttemptView>(`/calls/${call.id}`);
        setCall(r.data);
        setNow(Date.now());
      } catch {
        /* keep last state */
      }
    }, 2000);
    return () => clearInterval(id);
  }, [call]);

  const dial = async () => {
    setError(null);
    const k = key ?? newKey();
    setKey(k);
    try {
      const r = await api.post<CallAttemptView>('/calls', { callingRecordId: recordId }, k);
      setCall(r.data);
      setKey(null);
      setNow(Date.now());
    } catch (e) {
      setKey(null);
      setError(e instanceof ApiClientError ? e.message : 'Could not start the call.');
    }
  };

  const elapsed = call?.connectedAt ? Math.max(0, Math.round(((call.endedAt ? new Date(call.endedAt).getTime() : now) - new Date(call.connectedAt).getTime()) / 1000)) : null;

  const submit = async () => {
    if (!outcome) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const body: Record<string, unknown> = { outcome, remarks: remarks || undefined, selectedCardId: cardId ?? undefined, doNotContact: dnc || undefined, callAttemptId: call?.id };
      if (outcome === 'FOLLOW_UP') body.followUpAt = new Date(followUpAt).toISOString();
      const r = await api.post<{ hidden: boolean; interactionStatus: string }>(`/calling/records/${recordId}/outcomes`, body);
      setSaved(r.data.hidden ? 'Outcome saved — this customer moved to History.' : `Outcome saved (${r.data.interactionStatus.replace('_', ' ').toLowerCase()}).`);
      setOutcome(null);
      setRemarks('');
      setFollowUpAt('');
      setCardId(null);
      setDnc(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not save the outcome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-3">
      <Card className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium">Call</Text>
          {call ? <Badge label={STATE_LABEL[call.providerState]} variant={call.providerState === 'CONNECTED' ? 'success' : call.providerState === 'FAILED' || call.providerState === 'NO_ANSWER' ? 'destructive' : 'info'} /> : null}
        </View>
        {call?.disclosureText ? <Muted>Say before dialing: “{call.disclosureText}”</Muted> : null}
        {call ? (
          <Muted>
            To {call.targetMobileMasked} · started {formatDateTime(call.initiatedAt)}
            {elapsed !== null ? ` · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : ''}
            {call.durationSec !== null ? ` · ${call.durationSec}s` : ''}
          </Muted>
        ) : null}
        {call?.failureReason ? <Muted>Reason: {call.failureReason}</Muted> : null}
        {call && !live ? <Badge label={recordingChip(call.recording?.status)} variant={call.recording?.status === 'AVAILABLE' ? 'success' : 'secondary'} /> : null}
        <ErrorText>{error}</ErrorText>
        {!canCall ? (
          <Muted>Calling is not available for this customer.</Muted>
        ) : live ? (
          <Muted>Call in progress on your phone. Record the outcome once it ends.</Muted>
        ) : (
          <Button title={call ? (call.providerState === 'FAILED' ? 'Retry call' : 'Call again') : 'Call customer'} disabled={key !== null} onPress={() => void dial()} />
        )}
      </Card>

      <Card className="gap-2">
        <Text className="font-medium">Outcome</Text>
        {saved ? <Muted>{saved}</Muted> : null}
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(OUTCOME_LABELS) as CallOutcome[]).map((k) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: outcome === k }} onPress={() => setOutcome(k)} className={`rounded-full px-3 py-1.5 ${outcome === k ? 'bg-primary' : 'bg-secondary'}`}>
              <Text className={`text-xs ${outcome === k ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>{OUTCOME_LABELS[k]}</Text>
            </Pressable>
          ))}
        </View>
        {outcome === 'FOLLOW_UP' ? (
          <View className="gap-1">
            <Label>Follow-up at (YYYY-MM-DD HH:mm)</Label>
            <Input placeholder="2026-09-23 11:00" value={followUpAt} onChangeText={setFollowUpAt} />
          </View>
        ) : null}
        {(outcome === 'CONNECTED_INTERESTED' || outcome === 'CONNECTED_LINK_OR_PDF_SHARED') && cards.length ? (
          <View className="gap-1">
            <Label>Card discussed</Label>
            <View className="flex-row flex-wrap gap-2">
              {cards.map((c) => (
                <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ selected: cardId === c.id }} onPress={() => setCardId(cardId === c.id ? null : c.id)} className={`rounded-md border border-border px-2 py-1 ${cardId === c.id ? 'bg-primary' : ''}`}>
                  <Text className={`text-xs ${cardId === c.id ? 'text-primary-foreground' : ''}`}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View className="gap-1">
          <Label>Notes {outcome === 'FOLLOW_UP' || outcome === 'DECLINED' ? '(required)' : '(optional)'}</Label>
          <Input placeholder="What happened on the call" value={remarks} onChangeText={setRemarks} multiline />
        </View>
        <View className="flex-row items-center justify-between">
          <Text>Customer asked not to be contacted again</Text>
          <Switch value={dnc} onValueChange={setDnc} accessibilityLabel="do not contact" />
        </View>
        <Button title={saving ? 'Saving…' : 'Save outcome'} disabled={!outcome || saving || (outcome === 'FOLLOW_UP' && Number.isNaN(new Date(followUpAt).getTime()))} onPress={() => void submit()} />
        <Muted>Outcomes are operational only — bank status comes from the MIS, never from here.</Muted>
      </Card>
    </View>
  );
}
