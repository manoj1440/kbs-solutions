import { misStatusField } from '@kbs/shared';
import { Redirect } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { ActivationBadge, DecisionBadge, PayoutStateBadge, ProvenanceChip, StageBadge } from '@/components/status';
import { Card, Heading, Muted, Screen, Text } from '@/components/ui';

const AS_OF = '2026-09-20T10:30:00.000Z';
const SAMPLES = [
  { label: 'Never matched', field: misStatusField(null, false, null, null) },
  { label: 'Matched, blank cell', field: misStatusField('#N/A', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Inprocess', field: misStatusField('Inprocess', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Approve / Active', field: misStatusField('APPROVE', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Decline', field: misStatusField('Decline', true, AS_OF, 'KBS-M-DEMO1') },
];
const PAYOUTS = ['PENDING_HOLD', 'ELIGIBLE_AVAILABLE', 'RESERVED', 'UNDER_REVIEW', 'VOID', 'PENDING_APPROVALS', 'APPROVED', 'PAID', 'REJECTED'];

/** F-803 visual QA screen (dev builds only): every status / provenance variant with fixture data. */
export default function DevComponents() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-10">
        <Heading>Status components</Heading>
        <Muted>Text is always shown; colour only groups (REQ-20 §20.2).</Muted>
        {SAMPLES.map((s) => (
          <Card key={s.label} className="gap-2">
            <Text className="font-medium">{s.label}</Text>
            <StageBadge field={s.field} />
            <DecisionBadge field={s.field} />
            <ActivationBadge field={s.field} />
          </Card>
        ))}
        <Card className="gap-2">
          <Text className="font-medium">Provenance</Text>
          <ProvenanceChip provenance="BANK_MIS" asOf={AS_OF} />
          <ProvenanceChip provenance="KBS_OPERATIONAL" asOf={AS_OF} />
          <ProvenanceChip provenance="KBS_PAYMENT" asOf={AS_OF} />
        </Card>
        <Card className="gap-2">
          <Text className="font-medium">Payout states</Text>
          <View className="flex-row flex-wrap gap-2">
            {PAYOUTS.map((p) => (
              <PayoutStateBadge key={p} state={p} />
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
