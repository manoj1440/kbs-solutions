import type { LeadStatusRow } from '@kbs/shared';
import { formatDateTime } from '@kbs/shared';
import { Pressable, View } from 'react-native';

import { ActivationBadge, DecisionBadge, StageBadge } from '@/components/status';
import { Badge, Card, Muted, Text } from '@/components/ui';

/**
 * F-506 — compact mobile lead row (REQ-14 §14.3): line 1 customer + bank/card; line 2 KBS ref + bank ref if known;
 * three distinct Stage / Decision / Activation badges (even when unknown); last MIS matched time; truncated bank reason.
 * Never a single overloaded success/failed chip.
 */
export function LeadRow({ row, onPress }: { row: LeadStatusRow; onPress: () => void }) {
  const ref = row.bankApplicationNo ?? row.bankApplicationReference ?? row.bankReference?.value ?? null;
  const refVerified = row.bankApplicationNo !== null || row.bankApplicationReference !== null || row.bankReference?.status === 'VERIFIED_BY_MIS_MATCH';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open lead ${row.kbsRef}`} onPress={onPress}>
      <Card className="gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 font-medium" numberOfLines={1}>
            {row.customer.name}
          </Text>
          <Muted numberOfLines={1}>
            {row.bank.displayName} · {row.card.name}
          </Muted>
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <Muted>KBS {row.kbsRef}</Muted>
          {ref ? (
            <View className="flex-row items-center gap-1">
              <Muted>Bank ref {ref}</Muted>
              {!refVerified ? <Badge label="unverified" variant="warning" /> : null}
            </View>
          ) : (
            <Muted>Bank reference not yet available</Muted>
          )}
          {row.possibleCollision ? <Badge label="possible duplicate" variant="warning" /> : null}
        </View>
        <View className="flex-row flex-wrap gap-1">
          <StageBadge field={row.stage} />
          <DecisionBadge field={row.decision} />
          <ActivationBadge field={row.activation} />
        </View>
        <Muted>{row.lastMatchedAt ? `Last matched MIS: ${formatDateTime(row.lastMatchedAt)}` : 'Never matched to a bank MIS row'}</Muted>
        {row.remarksPreview ? <Muted numberOfLines={1}>{row.remarksPreview}</Muted> : null}
      </Card>
    </Pressable>
  );
}
