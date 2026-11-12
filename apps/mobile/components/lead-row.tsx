import type { LeadStatusRow } from '@kbs/shared';
import { formatDateTime } from '@kbs/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { StatusTrio } from '@/components/status';
import { Avatar, Badge, Card, Muted, Text } from '@/components/ui';
import { colors } from '@/lib/theme';
import { withBank } from '@/lib/cards';

/**
 * F-506 — compact mobile lead row (REQ-14 §14.3), restyled in F-805: customer + bank/card; KBS ref + bank ref if known;
 * three distinct Stage / Decision / Activation cells (even when unknown); last MIS matched time; truncated bank reason.
 * Never a single overloaded success/failed chip.
 */
export function LeadRow({ row, onPress }: { row: LeadStatusRow; onPress: () => void }) {
  const ref =
    row.bankApplicationNo ?? row.bankApplicationReference ?? row.bankReference?.value ?? null;
  const refVerified =
    row.bankApplicationNo !== null ||
    row.bankApplicationReference !== null ||
    row.bankReference?.status === 'VERIFIED_BY_MIS_MATCH';
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Open lead ${row.kbsRef}, ${row.customer.name}`}
      className="gap-3"
    >
      <View className="flex-row items-center gap-3">
        <Avatar name={row.customer.name} size={40} />
        <View className="flex-1">
          <Text className="font-medium text-base" numberOfLines={1}>
            {row.customer.name}
          </Text>
          <Muted numberOfLines={1}>{withBank(row.bank, row.card.name, ' · ')}</Muted>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
      </View>
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <Muted className="text-xs tabular-nums">{row.kbsRef}</Muted>
        {ref ? (
          <View className="flex-row items-center gap-1.5">
            <Muted className="text-xs tabular-nums">Bank ref {ref}</Muted>
            {!refVerified ? <Badge label="unverified" variant="warning" size="sm" /> : null}
          </View>
        ) : (
          <Muted className="text-xs">Bank reference not yet available</Muted>
        )}
        {row.possibleCollision ? (
          <Badge label="possible duplicate" variant="warning" size="sm" icon="copy-outline" />
        ) : null}
      </View>
      <StatusTrio stage={row.stage} decision={row.decision} activation={row.activation} />
      <View className="flex-row items-center gap-1.5">
        {/* provenance dot — Bank MIS */}
        <View className="h-1.5 w-1.5 rounded-full bg-[#5B2BA3]" />
        <Muted className="flex-1 text-xs text-[#737373]" numberOfLines={1}>
          {row.lastMatchedAt
            ? `Last matched MIS: ${formatDateTime(row.lastMatchedAt)}`
            : 'Never matched to a bank MIS row'}
        </Muted>
      </View>
      {row.remarksPreview ? (
        <Muted numberOfLines={1} className="text-xs text-[#737373]">
          “{row.remarksPreview}”
        </Muted>
      ) : null}
    </Card>
  );
}
