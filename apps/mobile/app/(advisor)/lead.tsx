import { ApiClientError, formatDateTime, type LeadStatusRow, type MisHistoryGroup, type OperationalEvent } from '@kbs/shared';
import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import type React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ShareButtons } from '@/components/share-buttons';
import { ActivationBadge, DecisionBadge, ProvenanceChip, StageBadge } from '@/components/status';
import { Badge, Button, Card, ErrorText, Heading, Input, Label, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface LeadDetail extends Omit<LeadStatusRow, 'bankReference'> {
  customerPanMasked: string | null;
  panVerificationStatus: string;
  cardId: string;
  pincode: string;
  city: string | null;
  state: string | null;
  employmentType: string;
  annualIncomeItr: number;
  operationalEvents: OperationalEvent[];
  bankStatus: { matched: boolean; provenance: string; lastMatchedAt: string | null; lastMatchedBatchRef: string | null; finalDecisionDate: string | null; raw: Record<string, string> | null };
  bankRemarks: { remarks: RemarkField[]; kyc: RemarkField[] };
  bankReference: { value: string | null; kind?: string; status?: string; label?: string; at?: string };
  referenceHistory: { id: string; value: string; status: string; at: string; supersededAt: string | null }[];
  linkActivity: { id: string; action: string; linkVersion: number; at: string; label: string }[];
  shares: { id: string; kind: string; at: string; handoffResult: string; deliveryStatus: string }[];
}
interface RemarkField {
  field: string;
  label: string;
  raw: string | null;
  display: string;
}

const CHANGE_LABEL: Record<string, string> = { SET: 'set', CHANGED: 'changed', CONFIRMED_SAME: 'confirmed unchanged', REPORTED_BLANK: 'reported blank', ABSENT_FROM_BATCH: 'absent from batch' };

function Section({ title, subtitle, open, onToggle, children }: { title: string; subtitle?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Card className="gap-2">
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-medium">{title}</Text>
          {subtitle ? <Muted>{subtitle}</Muted> : null}
        </View>
        <Muted>{open ? '▲' : '▼'}</Muted>
      </Pressable>
      {open ? children : null}
    </Card>
  );
}

/** F-408 lead detail: A customer + KBS activity, B references + raw snapshot, C bank remarks / KYC, MIS history by batch. No timeline. */
export default function LeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<LeadDetail | null>(null);
  const [history, setHistory] = useState<MisHistoryGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ remarks: true });
  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const [kind, setKind] = useState<'APPLICATION_NO' | 'APPLICATION_REFERENCE_NUMBER' | 'OTHER'>('APPLICATION_NO');
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
  const open = async () => {
    try {
      const r = await api.post<{ url: string }>(`/leads/${id}/link/open`, {});
      await Linking.openURL(r.data.url);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not open the link.');
    }
  };
  const saveRef = async () => {
    try {
      await api.post(`/leads/${id}/bank-reference`, { referenceKind: kind, referenceValue: ref });
      setRef('');
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not save the reference.');
    }
  };
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
              {l.remarksPreview ? <Muted>{l.remarksPreview}</Muted> : null}
            </Card>
            <Card className="gap-1">
              <Text className="font-medium">Customer</Text>
              <Muted>
                {l.customer.mobileMasked} · PAN {l.customerPanMasked} ({l.panVerificationStatus.toLowerCase()})
              </Muted>
              <Muted>
                {l.pincode} · {l.city ?? '—'}, {l.state ?? '—'} · {l.employmentType.toLowerCase().replace(/_/g, ' ')} · ₹{l.annualIncomeItr.toLocaleString('en-IN')}
              </Muted>
            </Card>
            <Card className="gap-2">
              <Text className="font-medium">Application link</Text>
              <Button title="Open application link" variant="outline" onPress={() => void open()} />
              <ShareButtons target={{ type: 'LEAD', id: l.id }} cardId={l.cardId} kinds={['APPLICATION_LINK']} onShared={() => void api.post(`/leads/${id}/link/share`, {}).then(load).catch(() => undefined)} />
              {l.linkActivity.map((a) => (
                <Muted key={a.id}>
                  {formatDateTime(a.at)} · {a.label} (v{a.linkVersion})
                </Muted>
              ))}
            </Card>
            <Card className="gap-2">
              <Text className="font-medium">Bank application reference</Text>
              {l.bankReference.value ? (
                <>
                  <Text>
                    {l.bankReference.value} <Badge label={l.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'Verified by MIS match' : 'Unverified'} variant={l.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'success' : 'warning'} />
                  </Text>
                </>
              ) : (
                <Muted>{l.bankReference.label ?? 'Bank application reference not yet available'}</Muted>
              )}
              {l.bankReference.status !== 'VERIFIED_BY_MIS_MATCH' ? (
                <>
                  <View className="flex-row gap-2">
                    {(['APPLICATION_NO', 'APPLICATION_REFERENCE_NUMBER', 'OTHER'] as const).map((k) => (
                      <Button key={k} title={k === 'APPLICATION_NO' ? 'App no.' : k === 'APPLICATION_REFERENCE_NUMBER' ? 'Ref no.' : 'Other'} variant={kind === k ? 'default' : 'outline'} onPress={() => setKind(k)} />
                    ))}
                  </View>
                  <Label>Reference exactly as the bank shows it</Label>
                  <Input value={ref} onChangeText={setRef} autoCapitalize="none" />
                  <Button title={l.bankReference.value ? 'Correct reference' : 'Save reference'} disabled={!ref.trim()} onPress={() => void saveRef()} />
                </>
              ) : null}
              {l.referenceHistory.filter((h) => h.supersededAt).map((h) => (
                <Muted key={h.id}>
                  Earlier: {h.value} ({formatDateTime(h.at)})
                </Muted>
              ))}
            </Card>
            <Section title="C · Bank reason / remarks" subtitle="Named bank fields, verbatim" open={!!expanded.remarks} onToggle={() => toggle('remarks')}>
              {l.bankRemarks.remarks.map((f) => (
                <View key={f.field} className="flex-row justify-between gap-2">
                  <Muted>{f.label}</Muted>
                  <Text className={`flex-1 text-right ${f.raw === null ? 'text-muted-foreground italic' : ''}`}>{f.display}</Text>
                </View>
              ))}
            </Section>
            <Section title="Bank/KYC information" subtitle="Sub-statuses and dates from the bank" open={!!expanded.kyc} onToggle={() => toggle('kyc')}>
              {l.bankRemarks.kyc.map((f) => (
                <View key={f.field} className="flex-row justify-between gap-2">
                  <Muted>{f.label}</Muted>
                  <Text className={`flex-1 text-right ${f.raw === null ? 'text-muted-foreground italic' : ''}`}>{f.display}</Text>
                </View>
              ))}
            </Section>
            <Section title="MIS update history" subtitle={history.length ? `${history.length} batch(es)` : 'No MIS batch has matched this lead yet'} open={!!expanded.history} onToggle={() => toggle('history')}>
              {history.map((g) => {
                const changed = g.changes.filter((c) => c.changeKind === 'SET' || c.changeKind === 'CHANGED' || c.changeKind === 'ABSENT_FROM_BATCH');
                const quiet = g.changes.length - changed.length;
                return (
                  <View key={g.batchId} className="gap-1 border-t border-border pt-2">
                    <Text className="text-xs font-medium">
                      {g.publicRef} · imported {formatDateTime(g.importedAt)} by {g.uploaderRole.toLowerCase()}
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
                          {c.reportedEventDate ? ` · bank date ${formatDateTime(c.reportedEventDate)}` : ''}
                        </Muted>
                      </View>
                    ))}
                    {quiet ? <Muted>{quiet} field(s) confirmed unchanged or reported blank</Muted> : null}
                  </View>
                );
              })}
            </Section>
            <Section title="B · Raw bank values" subtitle={l.bankStatus.raw ? `Batch ${l.bankStatus.lastMatchedBatchRef ?? ''}` : 'Awaiting MIS Update'} open={!!expanded.raw} onToggle={() => toggle('raw')}>
              {l.bankStatus.raw ? (
                Object.entries(l.bankStatus.raw).map(([k, v]) => (
                  <View key={k} className="flex-row justify-between gap-2">
                    <Muted>{k}</Muted>
                    <Text className="flex-1 text-right">{v === '' ? '(blank)' : v}</Text>
                  </View>
                ))
              ) : (
                <Muted>No MIS row has matched this lead yet.</Muted>
              )}
            </Section>
            <Section title="A · KBS activity" subtitle="Operational events — never a bank stage" open={!!expanded.ops} onToggle={() => toggle('ops')}>
              {l.operationalEvents.map((e) => (
                <View key={e.id} className="gap-0.5">
                  <Text className="text-xs">{e.label}</Text>
                  <Muted>
                    {formatDateTime(e.at)}
                    {e.detail ? ` · ${e.detail}` : ''} · KBS activity
                  </Muted>
                </View>
              ))}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
