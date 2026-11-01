import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  KeyValue,
  Muted,
  Segmented,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import type { Tone } from '@/lib/theme';

type RefKind = 'APPLICATION_NO' | 'APPLICATION_REFERENCE_NUMBER' | 'OTHER';

/** `GET /calling/interests` row (A21). Bank values are exactly what the MIS reported; null = not reported. */
export interface InterestView {
  id: string;
  at: string;
  customer: { id: string; fullName: string; mobileMasked: string };
  card: { id: string; name: string };
  bank: { id: string; displayName: string };
  reference: { kind: RefKind; value: string; enteredAt: string | null; verified: boolean } | null;
  stage: 'AWAITING_REFERENCE' | 'AWAITING_BANK_UPDATE' | 'IN_PROCESS' | 'APPROVED' | 'DECLINED';
  bankStatus: {
    asOf: string;
    applicationNo: string | null;
    currentStage: string | null;
    finalDecision: string | null;
    cardActivationStatus: string | null;
  } | null;
}

const STAGE: Record<InterestView['stage'], { label: (i: InterestView) => string; tone: Tone }> = {
  AWAITING_REFERENCE: { label: () => 'Add bank application no.', tone: 'warning' },
  AWAITING_BANK_UPDATE: { label: () => 'Awaiting bank update', tone: 'info' },
  IN_PROCESS: { label: (i) => i.bankStatus?.currentStage ?? 'In process', tone: 'info' },
  APPROVED: { label: (i) => i.bankStatus?.finalDecision ?? 'Approved', tone: 'success' },
  DECLINED: { label: (i) => i.bankStatus?.finalDecision ?? 'Declined', tone: 'destructive' },
};

/**
 * A21: one calling interest (a Telecaller "lead"). After the customer applies, the Telecaller types the bank application number
 * exactly as the bank shows it; the next MIS upload that carries it updates this card. Locked once the MIS has verified it.
 */
export function InterestCard({
  interest,
  showCustomer,
  onChanged,
}: {
  interest: InterestView;
  showCustomer?: boolean;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<RefKind>(interest.reference?.kind ?? 'APPLICATION_NO');
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(!interest.reference);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const s = STAGE[interest.stage];

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/calling/interests/${interest.id}/bank-reference`, {
        referenceKind: kind,
        referenceValue: value,
      });
      setValue('');
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not save the application number.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-semibold">
            {showCustomer
              ? interest.customer.fullName
              : `${interest.bank.displayName} ${interest.card.name}`}
          </Text>
          <Muted>
            {showCustomer
              ? `${interest.bank.displayName} ${interest.card.name} · ${interest.customer.mobileMasked}`
              : `Interested ${formatDateTime(interest.at)}`}
          </Muted>
        </View>
        <Badge label={s.label(interest)} variant={s.tone} />
      </View>

      {interest.bankStatus ? (
        <View>
          {interest.bankStatus.applicationNo ? (
            <KeyValue label="Bank application no." value={interest.bankStatus.applicationNo} />
          ) : null}
          <KeyValue label="Bank stage" value={interest.bankStatus.currentStage ?? 'Not reported'} />
          <KeyValue
            label="Final decision"
            value={interest.bankStatus.finalDecision ?? 'Not reported'}
          />
          <KeyValue
            label="Card activation"
            value={interest.bankStatus.cardActivationStatus ?? 'Not reported'}
          />
          <Muted>Bank MIS · {formatDateTime(interest.bankStatus.asOf)}</Muted>
        </View>
      ) : null}

      {interest.reference && !editing ? (
        <View className="flex-row items-center justify-between gap-3">
          <Muted className="flex-1">
            Reference {interest.reference.value} ·{' '}
            {interest.reference.verified ? 'verified by bank MIS' : 'not yet in a bank MIS'}
          </Muted>
          {!interest.reference.verified ? (
            <Button title="Correct" variant="ghost" size="sm" onPress={() => setEditing(true)} />
          ) : null}
        </View>
      ) : null}

      {editing ? (
        <View className="gap-3">
          <Muted>
            When the customer has applied, ask them for the application number the bank sent and
            type it exactly.
          </Muted>
          <Segmented<RefKind>
            value={kind}
            onChange={setKind}
            options={[
              { key: 'APPLICATION_NO', label: 'App no.' },
              { key: 'APPLICATION_REFERENCE_NUMBER', label: 'Ref no.' },
              { key: 'OTHER', label: 'Other' },
            ]}
          />
          <Input
            label="Bank application number"
            icon="document-text-outline"
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            title="Save application number"
            disabled={!value.trim() || saving}
            loading={saving}
            onPress={() => void save()}
          />
        </View>
      ) : null}
    </Card>
  );
}
