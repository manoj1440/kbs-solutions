import { ApiClientError, formatDateTime, formatInr, type LedgerPosition } from '@kbs/shared';
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
  Icon,
  IconCircle,
  type IconName,
  Muted,
  PressableScale,
  Screen,
  SectionHeader,
  Skeleton,
  StickyFooter,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors, gradientStyle, shadow, type Tone } from '@/lib/theme';

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

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
  payableUnderRule: { name: string; version: number };
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
  totalAmountInr: number;
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
  const total = chosen.reduce((a, r) => a + r.amountInr, 0);
  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const k = key ?? newKey();
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
      setError(e instanceof ApiClientError ? e.message : 'Could not submit the request.');
      setKey(null);
      await load();
    } finally {
      setBusy(false);
    }
  };
  const t = ledger?.totals;
  const tiles: [string, Tot | undefined, IconName, Tone | 'gold'][] = [
    ['Eligible', t?.eligible, 'ribbon-outline', 'default'],
    ['Available for claim', t?.available, 'wallet-outline', 'gold'],
    ['Requested', t?.requested, 'paper-plane-outline', 'info'],
    ['Approved, unpaid', t?.approvedUnpaid, 'hourglass-outline', 'warning'],
    ['Paid', t?.paid, 'checkmark-done-outline', 'success'],
    ['Under review', t?.underReview, 'alert-circle-outline', 'destructive'],
  ];

  return (
    <Screen
      inset="none"
      statusBar="light"
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
                  ? `Review ${chosen.length} card event(s) · ${formatInr(total)}`
                  : 'Select card events to request'
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
      <HeroHeader className="pb-16">
        <View className="flex-row items-center justify-between">
          <View>
            <RNText className="font-medium text-[13px] text-white/70">Payouts</RNText>
            <RNText accessibilityRole="header" className="font-bold text-[22px] text-white">
              Earnings
            </RNText>
          </View>
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={[gradientStyle(['#F9D37A', '#E39B1B'], 135), shadow.gold]}
          >
            <Icon name="wallet" size={22} color={colors.ink} />
          </View>
        </View>
        <View className="mt-6">
          <RNText className="font-semibold text-[12px] uppercase tracking-[1.4px] text-white/60">
            Available for claim
          </RNText>
          {t ? (
            <Appear>
              <RNText
                accessibilityLabel={`Available for claim ${formatInr(t.available.amountInr)}`}
                className="mt-1 font-extrabold text-[40px] tracking-tight text-gold"
              >
                {formatInr(t.available.amountInr)}
              </RNText>
            </Appear>
          ) : (
            <Skeleton className="mt-2 h-10 w-40 bg-white/20" />
          )}
          {t ? (
            <View className="mt-2 flex-row flex-wrap gap-2">
              <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-gold" />
                <RNText className="font-semibold text-[12px] text-white">
                  {t.available.count} card event(s)
                </RNText>
              </View>
              <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
                <RNText className="font-semibold text-[12px] text-white">
                  Paid {formatInr(t.paid.amountInr)}
                </RNText>
              </View>
            </View>
          ) : null}
        </View>
      </HeroHeader>

      <View className="-mt-12 gap-4 px-4">
        <Appear index={1}>
          <View className="rounded-3xl bg-white p-3" style={shadow.lg}>
            <View className="flex-row flex-wrap">
              {tiles.map(([label, v, icon, tone]) => (
                <View key={label} className="w-1/2 p-1">
                  <View className="gap-2.5 rounded-2xl bg-[#F7F8FC] p-3">
                    <IconCircle icon={icon} tone={tone} size={30} />
                    {v ? (
                      <View>
                        <RNText
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          className="font-extrabold text-[19px] tracking-tight text-ink"
                        >
                          {formatInr(v.amountInr)}
                        </RNText>
                        <RNText
                          numberOfLines={1}
                          className="font-semibold text-[12px] text-[#374151]"
                        >
                          {label}
                        </RNText>
                        <Muted className="text-[11px]">{v.count} card event(s)</Muted>
                      </View>
                    ) : (
                      <Skeleton className="h-5 w-20" />
                    )}
                  </View>
                </View>
              ))}
            </View>
            <View className="px-1 pb-1 pt-2">
              <MetaLine icon="git-branch-outline">
                Buckets overlap (e.g. requested events are also eligible) — don&apos;t add them up.
              </MetaLine>
              {ledger ? (
                <MetaLine icon="business-outline">
                  Source: bank MIS + KBS payout rule · as of {formatDateTime(ledger.asOf)}
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
            Card events appear here only when the bank MIS confirms the configured value under an
            approved KBS rule. Submitting a request is not an approval.
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
          {!ledger ? <Skeleton className="h-28 w-full rounded-2xl" /> : null}
          {ledger?.rows.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="No payout entitlements yet."
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
                  accessibilityLabel={`${row.customer}, ${formatInr(row.amountInr)}, ${row.position}`}
                  scaleTo={0.985}
                  onPress={() =>
                    selectable
                      ? toggle(row.entitlementId)
                      : router.push({ pathname: '/(advisor)/lead', params: { id: row.leadId } })
                  }
                  className={`gap-2.5 rounded-2xl bg-white p-4 ${isSel ? 'border-[1.5px] border-brand' : 'border border-line'}`}
                  style={
                    isSel ? { boxShadow: '0px 0px 0px 4px rgba(22, 50, 158, 0.10)' } : shadow.sm
                  }
                >
                  <View className="flex-row items-center gap-3">
                    {selectable ? (
                      <CheckBox checked={isSel} />
                    ) : (
                      <IconCircle icon="card-outline" tone="secondary" size={32} />
                    )}
                    <View className="flex-1">
                      <Text numberOfLines={1} className="font-bold text-[15px]">
                        {row.customer}
                      </Text>
                      <Muted numberOfLines={1} className="text-[12px]">
                        {row.kbsRef} · {row.bank.displayName} {row.card}
                      </Muted>
                    </View>
                    <RNText className="font-extrabold text-[17px] text-ink">
                      {formatInr(row.amountInr)}
                    </RNText>
                  </View>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Badge
                      label={row.position}
                      variant={POSITION_TONE[row.position] ?? 'warning'}
                      dot
                      size="sm"
                    />
                    <View className="rounded-full bg-[#F1ECFB] px-2 py-[2px]">
                      <RNText className="font-semibold text-[11px] text-[#5B2BA8]">
                        {row.triggerField} = “{row.rawActivation}”
                      </RNText>
                    </View>
                  </View>
                  <Muted className="text-[12px]">
                    bank ref {row.bankReference?.value ?? '—'} · {row.payableUnderRule.name} v
                    {row.payableUnderRule.version} · MIS {row.evidence.batchRef}
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
            <EmptyState compact icon="paper-plane-outline" title="No payout requests yet." />
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
                <IconCircle icon="receipt-outline" tone="gold" size={40} />
                <View className="flex-1">
                  <Text className="font-bold text-[15px]">{formatInr(r.totalAmountInr)}</Text>
                  <Muted className="text-[12px]">{r.publicRef}</Muted>
                </View>
                <PayoutStateBadge state={r.state} />
              </View>
              <Muted className="text-[12px]">
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
        <View className="rounded-2xl bg-[#F7F8FC] px-4 py-1">
          {chosen.map((c, i) => (
            <View
              key={c.entitlementId}
              className={`flex-row items-center gap-3 py-3 ${i < chosen.length - 1 ? 'border-b border-line' : ''}`}
            >
              <View className="flex-1">
                <Text className="font-semibold text-[14px]">{c.customer}</Text>
                <Muted className="text-[12px]">{c.kbsRef}</Muted>
              </View>
              <Text className="font-bold text-[14px]">{formatInr(c.amountInr)}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row items-center justify-between">
          <Muted>{chosen.length} card event(s)</Muted>
          <RNText className="font-extrabold text-[24px] text-ink">{formatInr(total)}</RNText>
        </View>
        <Callout kind="info">
          Amounts are the rates in force when each event became eligible; they will not change after
          submission.
        </Callout>
        <ErrorText>{error}</ErrorText>
      </BottomSheet>
    </Screen>
  );
}
