import { ApiClientError, formatDateTime, type LeadStatusRow, type MisHistoryGroup, type OperationalEvent } from '@kbs/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ActivationBadge, DecisionBadge, ProvenanceChip, StageBadge } from '@/components/status';
import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface RemarkField {
  field: string;
  label: string;
  raw: string | null;
  display: string;
}
interface LeadDetail extends Omit<LeadStatusRow, 'bankReference'> {
  customerPanMasked: string | null;
  pincode: string;
  city: string | null;
  state: string | null;
  operationalEvents: OperationalEvent[];
  bankStatus: { matched: boolean; lastMatchedBatchRef: string | null };
  bankRemarks: { remarks: RemarkField[]; kyc: RemarkField[] };
  bankReference: { value: string | null; status?: string; label?: string };
  advisor?: { fullName: string } | null;
}
const CHANGE_LABEL: Record<string, string> = { SET: 'set', CHANGED: 'changed', ABSENT_FROM_BATCH: 'absent from batch' };

function Fields({ title, rows }: { title: string; rows: RemarkField[] }) {
  return (
    <Card className="gap-1">
      <Text className="font-medium">{title}</Text>
      {rows.map((f) => (
        <View key={f.field} className="flex-row justify-between gap-2">
          <Muted>{f.label}</Muted>
          <Text className={`flex-1 text-right text-xs ${f.raw === null ? 'text-muted-foreground italic' : ''}`}>{f.display}</Text>
        </View>
      ))}
    </Card>
  );
}

/**
 * F-315 (Manager mobile): read-only lead view — the Manager checks the Advisor's lead and its real MIS values.
 * Reference entry, link actions and follow-up tasks stay with the Advisor (F-407 / F-409).
 */
export default function ManagerLeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<LeadDetail | null>(null);
  const [history, setHistory] = useState<MisHistoryGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [d, h] = await Promise.all([api.get<LeadDetail>(`/leads/${id}`), api.get<MisHistoryGroup[]>(`/leads/${id}/mis-history`)]);
      setL(d.data);
      setHistory(h.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the lead.');
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-3 pb-8">
        <Button title="← Back" variant="ghost" onPress={() => router.back()} />
        <ErrorText>{error}</ErrorText>
        {l ? (
          <>
            <View>
              <Muted>KBS {l.kbsRef}</Muted>
              <Heading>{l.customer.name}</Heading>
              <Muted>
                {l.bank.displayName} {l.card.name} · created {formatDateTime(l.leadCreatedAt)} (KBS activity)
              </Muted>
            </View>
            <Card className="gap-1">
              <Text className="font-medium">Bank status (from MIS only)</Text>
              <StageBadge field={l.stage} />
              <DecisionBadge field={l.decision} />
              <ActivationBadge field={l.activation} />
              <ProvenanceChip provenance="BANK_MIS" asOf={l.lastMatchedAt} />
              <Muted>{l.bankStatus.matched ? `Exact values from bank MIS batch ${l.bankStatus.lastMatchedBatchRef ?? ''}.` : 'No MIS row has matched this lead yet.'}</Muted>
            </Card>
            <Card className="gap-1">
              <Text className="font-medium">Customer</Text>
              <Muted>
                {l.customer.mobileMasked ?? ''} {l.customerPanMasked ? `· PAN ${l.customerPanMasked}` : ''}
              </Muted>
              <Muted>
                {l.pincode} · {l.city ?? '—'}, {l.state ?? '—'}
              </Muted>
              <Muted>Bank reference: {l.bankReference.value ?? l.bankReference.label ?? 'not yet available'}</Muted>
            </Card>
            <Fields title="Bank reason / remarks (verbatim)" rows={l.bankRemarks.remarks} />
            <Fields title="Bank / KYC information" rows={l.bankRemarks.kyc} />
            <Card className="gap-2">
              <Text className="font-medium">MIS update history</Text>
              {history.length === 0 ? <Muted>No MIS batch has matched this lead yet.</Muted> : null}
              {history.map((g) => {
                const changed = g.changes.filter((c) => c.changeKind === 'SET' || c.changeKind === 'CHANGED' || c.changeKind === 'ABSENT_FROM_BATCH');
                return (
                  <View key={g.batchId} className="gap-1 border-t border-border pt-2">
                    <Text className="text-xs font-medium">
                      {g.publicRef} · imported {formatDateTime(g.importedAt)}
                    </Text>
                    {changed.length === 0 ? <Muted>Identical repeat — no bank value changed.</Muted> : null}
                    {changed.map((c) => (
                      <View key={`${g.batchId}-${c.field}`} className="gap-0.5">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs">{c.field === '*' ? '(whole row)' : c.field}</Text>
                          <Badge label={CHANGE_LABEL[c.changeKind] ?? c.changeKind.toLowerCase()} variant={c.changeKind === 'ABSENT_FROM_BATCH' ? 'warning' : 'info'} />
                        </View>
                        <Muted>
                          {c.oldValue ?? 'blank'} → {c.newValue ?? 'blank'}
                        </Muted>
                      </View>
                    ))}
                  </View>
                );
              })}
            </Card>
            <Card className="gap-1">
              <Text className="font-medium">KBS activity</Text>
              <Muted>Operational events — never a bank stage.</Muted>
              {l.operationalEvents.map((e) => (
                <View key={e.id} className="gap-0.5">
                  <Text className="text-xs">{e.label}</Text>
                  <Muted>
                    {formatDateTime(e.at)}
                    {e.detail ? ` · ${e.detail}` : ''}
                  </Muted>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
