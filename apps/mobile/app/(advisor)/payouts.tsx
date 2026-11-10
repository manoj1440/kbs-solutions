import {
  ApiClientError,
  formatDateTime,
  formatInr,
  type LedgerPosition,
  newIdempotencyKey,
} from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { CheckBox, MetaLine } from '@/components/advisor/parts';
import { PayoutStateBadge } from '@/components/status';
import {
  Appear,
  Badge,
  BottomSheet,
  Button,
  Callout,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  ErrorText,
  HeroHeader,
  IconCircle,
  Muted,
  PressableScale,
  Screen,
  SectionHeader,
  Skeleton,
  StickyFooter,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { withBank } from '@/lib/cards';

interface LedgerRow {
  entitlementId: string;
  state: string;
  position: LedgerPosition;
  kbsRef: string;
  customer: string;
  leadId: string;
  bank: { code: string; displayName: string };
  card: string;
  bankReference: { kind: string; value: string; status: string } | null;
  lastMatchedAt: string | null;
  rawActivation: string;
  triggerField: string;
  /** null since payouts became rate-free */
  payableUnderRule: { name: string; version: number } | null;
  amountInr: number;
  eligibleAt: string;
  evidence: { batchRef: string; uploadedAt: string };
  request: { id: string; publicRef: string; state: string; submittedAt: string } | null;
  reviewReason: string | null;
}
interface Tot {
  count: number;
  amountInr: number;
}
interface Ledger {
  rows: LedgerRow[];
  totals: {
    eligible: Tot;
    available: Tot;
    requested: Tot;
    approvedUnpaid: Tot;
    paid: Tot;
    underReview: Tot;
    pendingHold: Tot;
  };
  asOf: string;
}
interface Req {
  id: string;
  publicRef: string;
  state: string;
  itemCount: number;
  /** Admin sets it; the Advisor sees it once paid (null before). */
  totalAmountInr: number | null;
  submittedAt: string;
  outstanding: string[];
}

const POSITION_TONE: Record<
  string,
  'success' | 'info' | 'warning' | 'unknown' | 'destructive' | 'secondary'
> = {
  'Available for claim': 'info',
  Paid: 'success',
  'Under review': 'destructive',
  'Pending hold': 'unknown',
  Void: 'unknown',
};

/**
 * F-603 Advisor payouts: ledger with §17.8 positions and totals (provenance: bank MIS + KBS rule), select eligible-available
 * card events, review the itemised amount, submit one request (idempotent), and open past requests.
 */
export default function Payouts() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [l, r] = await Promise.all([
        api.get<Ledger>('/payouts/me/ledger'),
        api.get<Req[]>('/payouts/requests?pageSize=50'),
      ]);
      setLedger(l.data);
      setRequests(r.data);
      setSelected((prev) =>
        prev.filter((id) =>
          l.data.rows.some((x) => x.entitlementId === id && x.state === 'ELIGIBLE_AVAILABLE'),
        ),
      );
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load payouts.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const available = ledger?.rows.filter((r) => r.state === 'ELIGIBLE_AVAILABLE') ?? [];
  const chosen = available.filter((r) => selected.includes(r.entitlementId));
  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const k = key ?? newIdempotencyKey();
      setKey(k); // a double tap re-sends the same key and replays the same request
      const r = await api.post<Req>(
        '/payouts/requests',
        { entitlementIds: chosen.map((c) => c.entitlementId) },
        k,
      );
      setConfirming(false);
      setSelected([]);
      setKey(null);
      await load();
      router.push({ pathname: '/(advisor)/payout-request', params: { id: r.data.id } });
    } catch (e) {
      setKey(null);
      await load(); // refresh first: load() clears `error`, so the message must be set after it
      setError(e instanceof ApiClientError ? e.message : 'Could not submit the request.');
    } finally {
      setBusy(false);
    }
  };
  const t = ledger?.totals;
  // rate-free payouts: card counts per stage; money appears only as what was paid
  const tiles: [string, Tot | undefined][] = [
    ['Activated cards', t?.eligible],
    ['Ready to claim', t?.available],
    ['Requested', t?.requested],
    ['Approved, unpaid', t?.approvedUnpaid],
    ['Paid', t?.paid],
    ['Under review', t?.underReview],
  ];

  return (
    <Screen
      inset="none"
      scroll
      padded={false}
      contentClassName="pt-0"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      footer={
        available.length ? (
          <StickyFooter>
            <Button
              title={
                chosen.length
                  ? `Request payout for ${chosen.length} card${chosen.length === 1 ? '' : 's'}`
                  : 'Select activated cards to request'
              }
              variant={chosen.length ? 'gold' : 'default'}
              icon="wallet-outline"
              disabled={!chosen.length}
              onPress={() => setConfirming(true)}
            />
          </StickyFooter>
        ) : null
      }
    >
      <HeroHeader>
        <RNText className="font-normal text-sm text-[#737373]">Payouts</RNText>
        <RNText accessibilityRole="header" className="font-medium text-2xl text-ink">
          Earnings
        </RNText>
      </HeroHeader>

      <View className="gap-4 px-4 pt-4">
        <Appear index={1}>
          <View className="rounded-xl border border-line bg-white p-4">
            <RNText className="font-normal text-sm text-[#525252]">Total earnings</RNText>
            {t ? (
              <RNText
                accessibilityLabel={`Total earnings ${formatInr(t.paid.amountInr)}`}
                className="mt-1 font-medium text-3xl text-gold tabular-nums"
              >
                {formatInr(t.paid.amountInr)}
              </RNText>
            ) : (
              <Skeleton className="mt-2 h-9 w-40" />
            )}
            {t ? (
              <View className="mt-2 flex-row flex-wrap gap-4">
                <View className="flex-row items-center gap-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-orange" />
                  <RNText className="font-normal text-sm text-[#525252] tabular-nums">
                    {t.available.count} to claim
                  </RNText>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-teal" />
                  <RNText className="font-normal text-sm text-[#525252] tabular-nums">
                    {t.paid.count} paid
                  </RNText>
                </View>
              </View>
            ) : null}
            <View className="mt-4 flex-row flex-wrap border-t border-line pt-1">
              {tiles.map(([label, v], i) => (
                <View
                  key={label}
                  className={`w-1/2 py-3 ${i % 2 ? 'border-l border-line pl-3' : 'pr-3'} ${i > 1 ? 'border-t border-line' : ''}`}
                >
                  {v ? (
                    <View>
                      <RNText numberOfLines={1} className="font-normal text-xs text-[#525252]">
                        {label}
                      </RNText>
                      <RNText
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        className="mt-0.5 font-medium text-lg text-ink tabular-nums"
                      >
                        {label === 'Paid' ? formatInr(v.amountInr) : v.count}
                      </RNText>
                      <Muted className="text-xs tabular-nums">
                        {v.count} card{v.count === 1 ? '' : 's'}
                      </Muted>
                    </View>
                  ) : (
                    <Skeleton className="h-5 w-20" />
                  )}
                </View>
              ))}
            </View>
            <View className="border-t border-line pt-3">
              <MetaLine icon="git-branch-outline">
                Activated cards include the ones already requested or paid
              </MetaLine>
              {ledger ? (
                <MetaLine icon="business-outline">
                  Card activation from the bank MIS; KBS decides each payout amount · as of{' '}
                  {formatDateTime(ledger.asOf)}
                </MetaLine>
              ) : null}
            </View>
          </View>
        </Appear>

        {error && !ledger ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : (
          <ErrorText>{error}</ErrorText>
        )}

        <Appear index={2}>
          <Callout kind="neutral">
            A card appears here once the bank MIS reports it activated. Your Manager approves your
            request, then KBS decides the amount and pays it.
          </Callout>
        </Appear>

        <Appear index={3} className="gap-3">
          <SectionHeader title="Card events" />
          {available.length ? (
            <View className="gap-2">
              <Muted>
                Select available card events. Reserved, paid, held or under-review events cannot be
                selected.
              </Muted>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label="Select all available"
                  icon="checkmark-done"
                  active={selected.length === available.length}
                  onPress={() => setSelected(available.map((r) => r.entitlementId))}
                />
                {selected.length ? (
                  <Chip label="Clear" icon="close" active={false} onPress={() => setSelected([])} />
                ) : null}
              </View>
            </View>
          ) : null}
          {!ledger ? <Skeleton className="h-28 w-full rounded-xl" /> : null}
          {ledger?.rows.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="No payout entitlements yet"
              body="They appear when a bank MIS reports the configured activation value for one of your leads."
            />
          ) : null}
          {ledger?.rows.map((row, i) => {
            const selectable = row.state === 'ELIGIBLE_AVAILABLE';
            const isSel = selected.includes(row.entitlementId);
            return (
              <Appear key={row.entitlementId} index={i}>
                <PressableScale
                  accessibilityRole={selectable ? 'checkbox' : 'button'}
                  accessibilityState={selectable ? { checked: isSel } : undefined}
                  accessibilityLabel={`${row.customer}, ${row.position}`}
                  scaleTo={0.985}
                  onPress={() =>
                    selectable
                      ? toggle(row.entitlementId)
                      : router.push({ pathname: '/(advisor)/lead', params: { id: row.leadId } })
                  }
                  className={`gap-2.5 rounded-xl p-4 ${isSel ? 'border border-gold bg-[#FDF1EC]' : 'border border-line bg-white'}`}
                >
                  <View className="flex-row items-center gap-3">
                    {selectable ? (
                      <CheckBox checked={isSel} />
                    ) : (
                      <IconCircle icon="card-outline" tone="secondary" size={32} />
                    )}
                    <View className="flex-1">
                      <Text numberOfLines={1} className="font-medium text-base">
                        {row.customer}
                      </Text>
                      <Muted numberOfLines={1} className="text-xs">
                        {row.kbsRef} · {withBank(row.bank, row.card)}
                      </Muted>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Badge
                      label={row.position}
                      variant={POSITION_TONE[row.position] ?? 'warning'}
                      dot
                      size="sm"
                    />
                    <View className="rounded-md bg-[#F1ECFB] px-2 py-0.5">
                      <RNText className="font-medium text-xs text-[#5B2BA8]">
                        {row.triggerField} = “{row.rawActivation}”
                      </RNText>
                    </View>
                  </View>
                  <Muted className="text-xs">
                    application no. {row.bankReference?.value ?? '—'} · MIS {row.evidence.batchRef}
                    {row.lastMatchedAt
                      ? ` · last matched ${formatDateTime(row.lastMatchedAt)}`
                      : ''}
                  </Muted>
                  {row.request ? (
                    <MetaLine icon="paper-plane-outline">Request {row.request.publicRef}</MetaLine>
                  ) : null}
                  {row.reviewReason ? (
                    <MetaLine icon="alert-circle-outline">{row.reviewReason}</MetaLine>
                  ) : null}
                </PressableScale>
              </Appear>
            );
          })}
        </Appear>

        <Appear index={4} className="gap-3">
          <SectionHeader title="My requests" />
          {ledger && requests.length === 0 ? (
            <EmptyState compact icon="paper-plane-outline" title="No payout requests yet" />
          ) : null}
          {requests.map((r) => (
            <Card
              key={r.id}
              onPress={() =>
                router.push({ pathname: '/(advisor)/payout-request', params: { id: r.id } })
              }
              accessibilityLabel={`Open payout request ${r.publicRef}`}
              className="gap-2"
            >
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="font-medium text-base tabular-nums">
                    {r.totalAmountInr != null
                      ? formatInr(r.totalAmountInr)
                      : `${r.itemCount} card${r.itemCount === 1 ? '' : 's'}`}
                  </Text>
                  <Muted className="text-xs">{r.publicRef}</Muted>
                </View>
                <PayoutStateBadge state={r.state} />
              </View>
              <Muted className="text-xs">
                {r.itemCount} card event(s) · {formatDateTime(r.submittedAt)}
                {r.outstanding.length
                  ? ` · outstanding: ${r.outstanding.join(' + ').toLowerCase()}`
                  : ''}
              </Muted>
            </Card>
          ))}
        </Appear>
      </View>

      <BottomSheet
        open={confirming}
        onClose={() => (busy ? undefined : setConfirming(false))}
        title="Confirm request"
        footer={
          <>
            <Button
              title="Back"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onPress={() => setConfirming(false)}
            />
            <Button
              title={busy ? 'Submitting…' : 'Submit request'}
              variant="gold"
              className="flex-[2]"
              loading={busy}
              disabled={busy}
              onPress={() => void submit()}
            />
          </>
        }
      >
        <View className="rounded-xl bg-raised px-4 py-1">
          {chosen.map((c, i) => (
            <View
              key={c.entitlementId}
              className={`flex-row items-center gap-3 py-3 ${i < chosen.length - 1 ? 'border-b border-line' : ''}`}
            >
              <View className="flex-1">
                <Text className="font-medium text-md">{c.customer}</Text>
                <Muted className="text-xs">{c.kbsRef}</Muted>
              </View>
            </View>
          ))}
        </View>
        <Muted>
          {chosen.length} activated card{chosen.length === 1 ? '' : 's'}
        </Muted>
        <Callout kind="info">
          Your Manager approves first, then KBS decides the amount and pays it. You will see the
          amount once it is paid.
        </Callout>
        <ErrorText>{error}</ErrorText>
      </BottomSheet>
    </Screen>
  );
}
