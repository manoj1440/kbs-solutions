import {
  ApiClientError,
  type AvailableCard,
  type CallAttemptView,
  type CallOutcome,
  formatDateTime,
  OUTCOME_LABELS,
  recordingChip,
} from '@kbs/shared';
import { useEffect, useState } from 'react';
import { Switch, Text as RNText, View } from 'react-native';

import {
  Badge,
  Button,
  Callout,
  Card,
  Chip,
  ChoiceRow,
  ErrorText,
  Icon,
  IconCircle,
  Input,
  Muted,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

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
export function CallDesk({
  recordId,
  canCall,
  cards,
  onChanged,
}: {
  recordId: string;
  canCall: boolean;
  cards: AvailableCard[];
  onChanged: () => Promise<void>;
}) {
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

  const elapsed = call?.connectedAt
    ? Math.max(
        0,
        Math.round(
          ((call.endedAt ? new Date(call.endedAt).getTime() : now) -
            new Date(call.connectedAt).getTime()) /
            1000,
        ),
      )
    : null;

  const submit = async () => {
    if (!outcome) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const body: Record<string, unknown> = {
        outcome,
        remarks: remarks || undefined,
        selectedCardId: cardId ?? undefined,
        doNotContact: dnc || undefined,
        callAttemptId: call?.id,
      };
      if (outcome === 'FOLLOW_UP') body.followUpAt = new Date(followUpAt).toISOString();
      const r = await api.post<{ hidden: boolean; interactionStatus: string }>(
        `/calling/records/${recordId}/outcomes`,
        body,
      );
      setSaved(
        r.data.hidden
          ? 'Outcome saved — this customer moved to History.'
          : `Outcome saved (${r.data.interactionStatus.replace('_', ' ').toLowerCase()}).`,
      );
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

  const stateTone = call
    ? call.providerState === 'CONNECTED'
      ? 'success'
      : call.providerState === 'FAILED' || call.providerState === 'NO_ANSWER'
        ? 'destructive'
        : 'info'
    : 'secondary';
  const timer =
    elapsed !== null
      ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
      : null;

  return (
    <View className="gap-4">
      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <IconCircle
            icon={live ? 'radio' : 'call'}
            tone={call ? stateTone : 'default'}
            size={40}
          />
          <View className="flex-1">
            <Text className="font-bold text-[16px]">Call</Text>
            <Muted className="text-[12px]">
              {call ? `To ${call.targetMobileMasked}` : 'No call started yet'}
            </Muted>
          </View>
          {call ? <Badge label={STATE_LABEL[call.providerState]} variant={stateTone} dot /> : null}
        </View>
        {call?.disclosureText ? (
          <Callout kind="warning" title="Say before dialing" icon="megaphone-outline">
            {`“${call.disclosureText}”`}
          </Callout>
        ) : null}
        {call ? (
          <View className="flex-row items-center justify-between rounded-2xl bg-[#F6F8FC] px-4 py-3">
            <View className="flex-1">
              <Muted className="text-[12px]">started {formatDateTime(call.initiatedAt)}</Muted>
              {call.durationSec !== null ? (
                <Muted className="text-[12px]">{call.durationSec}s</Muted>
              ) : null}
              {call.failureReason ? (
                <Muted className="text-[12px]">Reason: {call.failureReason}</Muted>
              ) : null}
            </View>
            {timer ? (
              <RNText className="font-extrabold text-[26px] tracking-tight text-ink">
                {timer}
              </RNText>
            ) : null}
          </View>
        ) : null}
        {call && !live ? (
          <Badge
            label={recordingChip(call.recording?.status)}
            variant={call.recording?.status === 'AVAILABLE' ? 'success' : 'secondary'}
            icon="mic-outline"
          />
        ) : null}
        <ErrorText>{error}</ErrorText>
        {!canCall ? (
          <Callout kind="neutral" icon="call-outline">
            Calling is not available for this customer.
          </Callout>
        ) : live ? (
          <View className="flex-row items-center gap-3 rounded-2xl bg-[#E6F4EC] px-4 py-3">
            <View className="h-2.5 w-2.5 rounded-full bg-[#1F7A4D]" />
            <RNText className="flex-1 font-medium text-[13px] text-[#1F6B45]">
              Call in progress on your phone. Record the outcome once it ends.
            </RNText>
          </View>
        ) : (
          <Button
            title={
              call
                ? call.providerState === 'FAILED'
                  ? 'Retry call'
                  : 'Call again'
                : 'Call customer'
            }
            icon="call"
            size="lg"
            loading={key !== null}
            disabled={key !== null}
            onPress={() => void dial()}
          />
        )}
      </Card>

      <Card className="gap-4">
        <View className="flex-row items-center gap-3">
          <IconCircle icon="create-outline" tone="info" size={40} />
          <View className="flex-1">
            <Text className="font-bold text-[16px]">Outcome</Text>
            <Muted className="text-[12px]">What happened on this call?</Muted>
          </View>
        </View>
        {saved ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-[#E6F4EC] px-3 py-2.5">
            <Icon name="checkmark-circle" size={16} color={colors.success} />
            <RNText className="flex-1 font-medium text-[13px] text-[#1F6B45]">{saved}</RNText>
          </View>
        ) : null}
        <View accessibilityRole="radiogroup" className="gap-2">
          {(Object.keys(OUTCOME_LABELS) as CallOutcome[]).map((k) => (
            <ChoiceRow
              key={k}
              label={OUTCOME_LABELS[k]}
              selected={outcome === k}
              onPress={() => setOutcome(k)}
            />
          ))}
        </View>
        {outcome === 'FOLLOW_UP' ? (
          <Input
            label="Follow-up at (YYYY-MM-DD HH:mm)"
            icon="calendar-outline"
            placeholder="2026-09-23 11:00"
            value={followUpAt}
            onChangeText={setFollowUpAt}
          />
        ) : null}
        {(outcome === 'CONNECTED_INTERESTED' || outcome === 'CONNECTED_LINK_OR_PDF_SHARED') &&
        cards.length ? (
          <View className="gap-2">
            <RNText className="font-semibold text-[13px] text-ink">Card discussed</RNText>
            <View className="flex-row flex-wrap gap-2">
              {cards.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  icon="card-outline"
                  active={cardId === c.id}
                  onPress={() => setCardId(cardId === c.id ? null : c.id)}
                />
              ))}
            </View>
          </View>
        ) : null}
        <Input
          label={`Notes ${outcome === 'FOLLOW_UP' || outcome === 'DECLINED' ? '(required)' : '(optional)'}`}
          placeholder="What happened on the call"
          value={remarks}
          onChangeText={setRemarks}
          multiline
        />
        <View
          className={`flex-row items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 ${dnc ? 'border-[#F5C2BE] bg-[#FDECEA]' : 'border-line bg-white'}`}
        >
          <Icon name="hand-left-outline" size={18} color={dnc ? colors.danger : colors.subtle} />
          <Text className="flex-1 text-[14px]">Customer asked not to be contacted again</Text>
          <Switch
            value={dnc}
            onValueChange={setDnc}
            accessibilityLabel="do not contact"
            trackColor={{ true: colors.danger, false: '#D5DAE6' }}
          />
        </View>
        <Button
          title={saving ? 'Saving…' : 'Save outcome'}
          icon="checkmark"
          size="lg"
          loading={saving}
          disabled={
            !outcome ||
            saving ||
            (outcome === 'FOLLOW_UP' && Number.isNaN(new Date(followUpAt).getTime()))
          }
          onPress={() => void submit()}
        />
        <View className="flex-row items-start gap-2">
          <Icon
            name="shield-checkmark-outline"
            size={14}
            color={colors.subtle}
            style={{ marginTop: 2 }}
          />
          <Muted className="flex-1 text-[12px]">
            Outcomes are operational only — bank status comes from the MIS, never from here.
          </Muted>
        </View>
      </Card>
    </View>
  );
}
