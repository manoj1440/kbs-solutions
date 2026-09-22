import { ApiClientError, formatDateTime, formatInr, type LedgerPosition } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { PayoutStateBadge } from '@/components/status';
import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

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
  totals: { eligible: Tot; available: Tot; requested: Tot; approvedUnpaid: Tot; paid: Tot; underReview: Tot; pendingHold: Tot };
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

const POSITION_TONE: Record<string, 'success' | 'info' | 'warning' | 'unknown' | 'destructive' | 'secondary'> = { 'Available for claim': 'info', Paid: 'success', 'Under review': 'destructive', 'Pending hold': 'unknown', Void: 'unknown' };

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
  const load = useCallback(async () => {
    setError(null);
    try {
      const [l, r] = await Promise.all([api.get<Ledger>('/payouts/me/ledger'), api.get<Req[]>('/payouts/requests?pageSize=50')]);
      setLedger(l.data);
      setRequests(r.data);
      setSelected((prev) => prev.filter((id) => l.data.rows.some((x) => x.entitlementId === id && x.state === 'ELIGIBLE_AVAILABLE')));
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
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const k = key ?? newKey();
      setKey(k); // a double tap re-sends the same key and replays the same request
      const r = await api.post<Req>('/payouts/requests', { entitlementIds: chosen.map((c) => c.entitlementId) }, k);
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
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-3 pb-8">
        <Heading>Payouts</Heading>
        <Muted>Card events appear here only when the bank MIS confirms the configured value under an approved KBS rule. Submitting a request is not an approval.</Muted>
        <ErrorText>{error}</ErrorText>
        {t ? (
          <View className="flex-row flex-wrap gap-2">
            {(
              [
                ['Eligible', t.eligible],
                ['Available for claim', t.available],
                ['Requested', t.requested],
                ['Approved, unpaid', t.approvedUnpaid],
                ['Paid', t.paid],
                ['Under review', t.underReview],
              ] as [string, Tot][]
            ).map(([label, v]) => (
              <Card key={label} className="min-w-[45%] flex-1">
                <Muted>{label}</Muted>
                <Text className="text-lg font-semibold">
                  {v.count} · {formatInr(v.amountInr)}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}
        {ledger ? <Muted>Source: bank MIS + KBS payout rule · as of {formatDateTime(ledger.asOf)}</Muted> : null}

        {available.length ? (
          <Card className="gap-2">
            <Text className="font-medium">Request a payout</Text>
            <Muted>Select available card events. Reserved, paid, held or under-review events cannot be selected.</Muted>
            <View className="flex-row gap-2">
              <Button title="Select all available" variant="outline" onPress={() => setSelected(available.map((r) => r.entitlementId))} />
              {selected.length ? <Button title="Clear" variant="ghost" onPress={() => setSelected([])} /> : null}
            </View>
            {!confirming ? (
              <Button title={chosen.length ? `Review ${chosen.length} card event(s) · ${formatInr(total)}` : 'Select card events to request'} disabled={!chosen.length} onPress={() => setConfirming(true)} />
            ) : (
              <Card className="gap-2 border-primary">
                <Text className="font-medium">Confirm request</Text>
                {chosen.map((c) => (
                  <Muted key={c.entitlementId}>
                    {c.kbsRef} · {c.customer} · {formatInr(c.amountInr)}
                  </Muted>
                ))}
                <Text className="font-semibold">
                  {chosen.length} card event(s) · {formatInr(total)}
                </Text>
                <Muted>Amounts are the rates in force when each event became eligible; they will not change after submission.</Muted>
                <View className="flex-row gap-2">
                  <Button title={busy ? 'Submitting…' : 'Submit request'} disabled={busy} onPress={() => void submit()} />
                  <Button title="Back" variant="outline" disabled={busy} onPress={() => setConfirming(false)} />
                </View>
              </Card>
            )}
          </Card>
        ) : null}

        <Text className="font-medium">My requests</Text>
        {requests.length === 0 ? <Muted>No payout requests yet.</Muted> : null}
        {requests.map((r) => (
          <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(advisor)/payout-request', params: { id: r.id } })}>
            <Card className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-medium">{r.publicRef}</Text>
                <PayoutStateBadge state={r.state} />
              </View>
              <Muted>
                {formatInr(r.totalAmountInr)} · {r.itemCount} card event(s) · {formatDateTime(r.submittedAt)}
                {r.outstanding.length ? ` · outstanding: ${r.outstanding.join(' + ').toLowerCase()}` : ''}
              </Muted>
            </Card>
          </Pressable>
        ))}

        <Text className="font-medium">Ledger</Text>
        {ledger?.rows.length === 0 ? (
          <Card>
            <Text>No payout entitlements yet.</Text>
            <Muted>They appear when a bank MIS reports the configured activation value for one of your leads.</Muted>
          </Card>
        ) : null}
        {ledger?.rows.map((row) => {
          const selectable = row.state === 'ELIGIBLE_AVAILABLE';
          const isSel = selected.includes(row.entitlementId);
          return (
            <Pressable key={row.entitlementId} accessibilityRole={selectable ? 'checkbox' : 'button'} accessibilityState={selectable ? { checked: isSel } : undefined} onPress={() => (selectable ? toggle(row.entitlementId) : router.push({ pathname: '/(advisor)/lead', params: { id: row.leadId } }))}>
              <Card className={`gap-1 ${isSel ? 'border-primary' : ''}`}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-medium">
                    {selectable ? (isSel ? '☑ ' : '☐ ') : ''}
                    {row.customer}
                  </Text>
                  <Badge label={row.position} variant={POSITION_TONE[row.position] ?? 'warning'} />
                </View>
                <Muted>
                  {row.kbsRef} · {row.bank.displayName} {row.card} · bank ref {row.bankReference?.value ?? '—'}
                </Muted>
                <Text>
                  {formatInr(row.amountInr)} · {row.triggerField} = “{row.rawActivation}”
                </Text>
                <Muted>
                  {row.payableUnderRule.name} v{row.payableUnderRule.version} · MIS {row.evidence.batchRef}
                  {row.lastMatchedAt ? ` · last matched ${formatDateTime(row.lastMatchedAt)}` : ''}
                </Muted>
                {row.request ? <Muted>Request {row.request.publicRef}</Muted> : null}
                {row.reviewReason ? <Muted>{row.reviewReason}</Muted> : null}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
