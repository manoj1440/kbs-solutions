import { ApiClientError, formatDateTime, formatInr } from '@kbs/shared';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { PayoutStateBadge } from '@/components/status';
import { Badge, Button, Card, ErrorText, Heading, Input, Label, Muted, Text } from '@/components/ui';
import { api } from '@/lib/api';

export interface PayoutRequestDto {
  id: string;
  publicRef: string;
  state: string;
  advisor: { id: string; fullName: string };
  managerApprover: { id: string; fullName: string } | null;
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  cancelReason: string | null;
  approvals: { manager: Approval | null; admin: Approval | null; outstanding: string[]; order: string };
  me: { role: 'MANAGER' | 'ADMIN' | null; canApprove: boolean; canCancel: boolean };
  items: {
    id: string;
    entitlementId: string;
    amountSnapshotInr: number;
    entitlementState: string;
    warnings: string[];
    lead: { id: string; publicRef: string; customerFullName: string };
    bank: { code: string; displayName: string };
    card: string;
    triggerField: string;
    triggerFieldValue: string;
    rule: { name: string; version: number };
    evidence: { batchRef: string; uploadedAt: string };
    eligibleAt: string;
    priorRequests: { id: string; publicRef: string; state: string; submittedAt: string }[];
  }[];
  payment: { paidAt: string; amountInr: number; transferReference: string; state: string } | null;
}
interface Approval {
  by: { id: string; fullName: string; role: string };
  decision: string;
  reason: string | null;
  at: string;
}

/** F-603/F-604 — itemised request with MIS evidence, the two approval rows, payment status, and the actions the viewer may take. */
export function PayoutRequestDetail({ id }: { id: string }) {
  const [r, setR] = useState<PayoutRequestDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setR((await api.get<PayoutRequestDto>(`/payouts/requests/${id}`)).data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the request.');
    }
  }, [id]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setReason('');
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };
  if (r === null && !error) void load();
  if (!r) return <ErrorText>{error}</ErrorText>;
  const row = (label: string, a: Approval | null, pending: boolean) => (
    <View className="flex-row items-center justify-between gap-2">
      <Text>{label}</Text>
      {a ? (
        <View className="items-end">
          <Badge label={a.decision === 'APPROVED' ? 'Approved' : 'Rejected'} variant={a.decision === 'APPROVED' ? 'success' : 'destructive'} />
          <Muted>
            {a.by.fullName} · {formatDateTime(a.at)}
          </Muted>
          {a.reason ? <Muted>{a.reason}</Muted> : null}
        </View>
      ) : (
        <Badge label={pending ? 'Pending' : '—'} variant={pending ? 'warning' : 'unknown'} />
      )}
    </View>
  );
  return (
    <View className="gap-3">
      <View>
        <Muted>{r.publicRef}</Muted>
        <Heading>{formatInr(r.totalAmountInr)}</Heading>
        <View className="flex-row flex-wrap items-center gap-2">
          <PayoutStateBadge state={r.state} />
          <Muted>
            {r.itemCount} card event(s) · submitted {formatDateTime(r.submittedAt)} by {r.advisor.fullName}
          </Muted>
        </View>
        <Muted>A submitted request is not an approval; Accounts pays only after both approvals.</Muted>
      </View>
      <ErrorText>{error}</ErrorText>
      <Card className="gap-2">
        <Text className="font-medium">Approvals</Text>
        {row(`Manager (${r.managerApprover?.fullName ?? '—'})`, r.approvals.manager, r.state === 'PENDING_APPROVALS')}
        {row('Admin', r.approvals.admin, r.state === 'PENDING_APPROVALS')}
        {r.state === 'CANCELLED' ? <Muted>Cancelled: {r.cancelReason}</Muted> : null}
        {r.payment ? (
          <Muted>
            Payment {r.payment.state.toLowerCase()} · {formatInr(r.payment.amountInr)} · ref {r.payment.transferReference} · {formatDateTime(r.payment.paidAt)}
          </Muted>
        ) : r.state === 'APPROVED' ? (
          <Muted>Both approved — awaiting Accounts payment.</Muted>
        ) : null}
      </Card>
      {r.me.canApprove || r.me.canCancel ? (
        <Card className="gap-2">
          <Label>Reason (required to reject or cancel)</Label>
          <Input value={reason} onChangeText={setReason} placeholder="Reason" />
          <View className="flex-row flex-wrap gap-2">
            {r.me.canApprove ? (
              <>
                <Button title={`Approve as ${r.me.role?.toLowerCase()}`} disabled={busy} onPress={() => void act(() => api.post(`/payouts/requests/${r.id}/approvals`, { decision: 'APPROVED', ...(reason.trim() ? { reason: reason.trim() } : {}) }))} />
                <Button title="Reject" variant="destructive" disabled={busy || reason.trim().length < 3} onPress={() => void act(() => api.post(`/payouts/requests/${r.id}/approvals`, { decision: 'REJECTED', reason: reason.trim() }))} />
              </>
            ) : null}
            {r.me.canCancel ? <Button title="Cancel request" variant="outline" disabled={busy || reason.trim().length < 3} onPress={() => void act(() => api.post(`/payouts/requests/${r.id}/cancel`, { reason: reason.trim() }))} /> : null}
          </View>
        </Card>
      ) : null}
      <Text className="font-medium">Itemised card events</Text>
      {r.items.map((i) => (
        <Card key={i.id} className="gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-medium">{i.lead.customerFullName}</Text>
            <Text>{formatInr(i.amountSnapshotInr)}</Text>
          </View>
          <Muted>
            {i.lead.publicRef} · {i.bank.displayName} {i.card}
          </Muted>
          <Muted>
            MIS evidence: {i.triggerField} = “{i.triggerFieldValue}” · batch {i.evidence.batchRef} ({formatDateTime(i.evidence.uploadedAt)})
          </Muted>
          <Muted>
            Rule {i.rule.name} v{i.rule.version} · eligible {formatDateTime(i.eligibleAt)}
          </Muted>
          {i.warnings.map((w) => (
            <Badge key={w} label={w} variant="warning" />
          ))}
          {i.priorRequests.length ? <Muted>Prior requests for this lead: {i.priorRequests.map((p) => `${p.publicRef} (${p.state.toLowerCase()})`).join(', ')}</Muted> : null}
        </Card>
      ))}
    </View>
  );
}
