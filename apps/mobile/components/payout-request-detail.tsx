import { ApiClientError, formatDateTime, formatInr } from '@kbs/shared';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { PayoutStateBadge } from '@/components/status';
import {
  Appear,
  Badge,
  Button,
  Callout,
  Card,
  ErrorState,
  ErrorText,
  Icon,
  IconCircle,
  Input,
  KeyValue,
  Muted,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';

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
  approvals: {
    manager: Approval | null;
    admin: Approval | null;
    outstanding: string[];
    order: string;
  };
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
  /** Advisor-safe receipt (masked reference, no proof/operator) — REQ-18 §18.2. */
  receipt: {
    state: string;
    paidAt: string;
    amountInr: number;
    transferReferenceMasked: string | null;
    method: string | null;
  } | null;
  /** Full entry for Manager/Admin; null for the Advisor. */
  payment: { paidAt: string; amountInr: number; transferReference: string; state: string } | null;
  paidAt: string | null;
}

const RECEIPT_LABEL: Record<string, string> = {
  VERIFIED: 'Paid',
  PROOF_PENDING: 'Payment recorded — receipt being finalised',
  RECORDED: 'Payment recorded',
  EXCEPTION: 'Payment under review by KBS',
};
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
      setError(null);
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
  if (!r) {
    if (error) return <ErrorState message={error} onRetry={() => void load()} />;
    return (
      <View accessibilityLabel="Loading" className="gap-4">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </View>
    );
  }
  const row = (label: string, a: Approval | null, pending: boolean, last?: boolean) => (
    <View className={`flex-row items-start gap-3 py-3 ${last ? '' : 'border-b border-line'}`}>
      <IconCircle
        icon={
          a ? (a.decision === 'APPROVED' ? 'checkmark-circle' : 'close-circle') : 'time-outline'
        }
        tone={
          a
            ? a.decision === 'APPROVED'
              ? 'success'
              : 'destructive'
            : pending
              ? 'warning'
              : 'unknown'
        }
        size={36}
      />
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold text-[14px]">{label}</Text>
        {a ? (
          <>
            <Muted className="text-[12px]">
              {a.by.fullName} · {formatDateTime(a.at)}
            </Muted>
            {a.reason ? <Muted className="text-[12px] italic">“{a.reason}”</Muted> : null}
          </>
        ) : null}
      </View>
      {a ? (
        <Badge
          label={a.decision === 'APPROVED' ? 'Approved' : 'Rejected'}
          variant={a.decision === 'APPROVED' ? 'success' : 'destructive'}
          dot
        />
      ) : (
        <Badge
          label={pending ? 'Pending' : '—'}
          variant={pending ? 'warning' : 'unknown'}
          dot={pending}
        />
      )}
    </View>
  );
  return (
    <View className="gap-4">
      <Appear>
        <View
          className="overflow-hidden rounded-3xl p-5"
          style={[gradientStyle(gradients.hero, 135), shadow.lg]}
        >
          <View
            pointerEvents="none"
            className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.07]"
          />
          <View
            pointerEvents="none"
            className="absolute -bottom-10 left-8 h-28 w-28 rounded-full"
            style={{ backgroundColor: 'rgba(245, 185, 66, 0.12)' }}
          />
          <View className="flex-row items-center justify-between gap-2">
            <RNText
              selectable
              className="font-semibold text-[12px] uppercase tracking-[1.2px] text-white/60"
            >
              {r.publicRef}
            </RNText>
            <View className="rounded-full bg-white p-0.5">
              <PayoutStateBadge state={r.state} />
            </View>
          </View>
          <RNText
            accessibilityRole="header"
            className="mt-2 font-extrabold text-[36px] tracking-tight text-gold"
          >
            {formatInr(r.totalAmountInr)}
          </RNText>
          <RNText className="mt-1 font-medium text-[13px] leading-[19px] text-white/75">
            {r.itemCount} card event(s) · submitted {formatDateTime(r.submittedAt)} by{' '}
            {r.advisor.fullName}
          </RNText>
        </View>
      </Appear>
      <Appear index={1}>
        <Callout kind="neutral">
          A submitted request is not an approval; Accounts pays only after both approvals.
        </Callout>
      </Appear>
      <ErrorText>{error}</ErrorText>
      <Appear index={2}>
        <Card className="gap-1">
          <RNText accessibilityRole="header" className="font-bold text-[15px] text-ink">
            Approvals
          </RNText>
          {row(
            `Manager (${r.managerApprover?.fullName ?? '—'})`,
            r.approvals.manager,
            r.state === 'PENDING_APPROVALS',
          )}
          {row('Admin', r.approvals.admin, r.state === 'PENDING_APPROVALS', true)}
          {r.state === 'CANCELLED' ? (
            <Callout kind="danger">{`Cancelled: ${r.cancelReason ?? ''}`}</Callout>
          ) : null}
          {r.payment ? (
            <View className="mt-1 rounded-xl bg-[#F4F6FB] px-3 py-2.5">
              <Muted className="text-[12px]">
                Payment {r.payment.state.toLowerCase().replace(/_/g, ' ')} ·{' '}
                {formatInr(r.payment.amountInr)} · ref {r.payment.transferReference} ·{' '}
                {formatDateTime(r.payment.paidAt)}
              </Muted>
            </View>
          ) : r.state === 'APPROVED' ? (
            <View className="mt-1 flex-row items-center gap-2 rounded-xl bg-[#FFF4DB] px-3 py-2.5">
              <Icon name="hourglass-outline" size={15} color="#7A4F00" />
              <RNText className="flex-1 font-medium text-[13px] text-[#7A4F00]">
                Both approved — awaiting Accounts payment.
              </RNText>
            </View>
          ) : null}
        </Card>
      </Appear>
      {r.receipt ? (
        <Appear index={3}>
          <Card className="gap-3" style={{ borderColor: '#BFE3CF' }}>
            <View className="flex-row items-center gap-3">
              <IconCircle
                icon={r.state === 'PAID' ? 'checkmark-done' : 'receipt-outline'}
                tone={r.state === 'PAID' ? 'success' : 'warning'}
                size={40}
              />
              <Text className="flex-1 font-bold text-[15px]">
                {r.state === 'PAID'
                  ? 'Paid'
                  : (RECEIPT_LABEL[r.receipt.state] ?? 'Payment recorded')}
              </Text>
              <Badge
                label={r.state === 'PAID' ? 'Paid' : 'In progress'}
                variant={r.state === 'PAID' ? 'success' : 'warning'}
              />
            </View>
            <RNText className="font-extrabold text-[26px] text-ink">
              {formatInr(r.receipt.amountInr)}
            </RNText>
            <View>
              <KeyValue
                label="Paid on"
                value={`${formatDateTime(r.receipt.paidAt)}${r.receipt.method ? ` · ${r.receipt.method}` : ''}`}
              />
              <KeyValue
                label="Bank reference"
                value={r.receipt.transferReferenceMasked ?? '—'}
                last
              />
            </View>
            <Muted className="text-[12px]">
              Transferred by KBS Accounts to your registered bank account. Card events in this
              request are paid for this event.
            </Muted>
          </Card>
        </Appear>
      ) : null}
      {r.me.canApprove || r.me.canCancel ? (
        <Appear index={4}>
          <Card className="gap-3">
            <Input
              label="Reason (required to reject or cancel)"
              icon="create-outline"
              value={reason}
              onChangeText={setReason}
              placeholder="Reason"
            />
            <View className="flex-row flex-wrap gap-2">
              {r.me.canApprove ? (
                <>
                  <Button
                    title={`Approve as ${r.me.role?.toLowerCase()}`}
                    icon="checkmark"
                    className="flex-1"
                    disabled={busy}
                    onPress={() =>
                      void act(() =>
                        api.post(`/payouts/requests/${r.id}/approvals`, {
                          decision: 'APPROVED',
                          ...(reason.trim() ? { reason: reason.trim() } : {}),
                        }),
                      )
                    }
                  />
                  <Button
                    title="Reject"
                    variant="destructive"
                    disabled={busy || reason.trim().length < 3}
                    onPress={() =>
                      void act(() =>
                        api.post(`/payouts/requests/${r.id}/approvals`, {
                          decision: 'REJECTED',
                          reason: reason.trim(),
                        }),
                      )
                    }
                  />
                </>
              ) : null}
              {r.me.canCancel ? (
                <Button
                  title="Cancel request"
                  variant="outline"
                  className="flex-1"
                  disabled={busy || reason.trim().length < 3}
                  onPress={() =>
                    void act(() =>
                      api.post(`/payouts/requests/${r.id}/cancel`, { reason: reason.trim() }),
                    )
                  }
                />
              ) : null}
            </View>
          </Card>
        </Appear>
      ) : null}
      <SectionHeader title="Itemised card events" className="mt-1" />
      {r.items.map((i, idx) => (
        <Appear key={i.id} index={5 + idx}>
          <Card className="gap-2.5">
            <View className="flex-row items-center gap-3">
              <IconCircle icon="card-outline" size={38} />
              <View className="flex-1">
                <Text numberOfLines={1} className="font-bold text-[15px]">
                  {i.lead.customerFullName}
                </Text>
                <Muted numberOfLines={1} className="text-[12px]">
                  {i.lead.publicRef} · {i.bank.displayName} {i.card}
                </Muted>
              </View>
              <RNText className="font-extrabold text-[16px] text-ink">
                {formatInr(i.amountSnapshotInr)}
              </RNText>
            </View>
            <View className="gap-1.5 rounded-xl bg-[#F4F6FB] p-3">
              <View className="flex-row items-start gap-1.5">
                <Icon name="business-outline" size={13} color="#5B2BA8" style={{ marginTop: 2 }} />
                <Muted className="flex-1 text-[12px]">
                  MIS evidence: {i.triggerField} = “{i.triggerFieldValue}” · batch{' '}
                  {i.evidence.batchRef} ({formatDateTime(i.evidence.uploadedAt)})
                </Muted>
              </View>
              <View className="flex-row items-start gap-1.5">
                <Icon
                  name="document-text-outline"
                  size={13}
                  color={colors.subtle}
                  style={{ marginTop: 2 }}
                />
                <Muted className="flex-1 text-[12px]">
                  Rule {i.rule.name} v{i.rule.version} · eligible {formatDateTime(i.eligibleAt)}
                </Muted>
              </View>
            </View>
            {i.warnings.length ? (
              <View className="flex-row flex-wrap gap-1.5">
                {i.warnings.map((w) => (
                  <Badge key={w} label={w} variant="warning" icon="warning-outline" />
                ))}
              </View>
            ) : null}
            {i.priorRequests.length ? (
              <Muted className="text-[12px]">
                Prior requests for this lead:{' '}
                {i.priorRequests.map((p) => `${p.publicRef} (${p.state.toLowerCase()})`).join(', ')}
              </Muted>
            ) : null}
          </Card>
        </Appear>
      ))}
    </View>
  );
}
