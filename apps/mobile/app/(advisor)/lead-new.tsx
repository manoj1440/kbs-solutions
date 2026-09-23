import { amountInput, ApiClientError, digitsOnly, mobileInput, panInput, type LeadDraftView, type LeadStep } from '@kbs/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Input, Label, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

const TITLES: Record<LeadStep, string> = { MOBILE: 'Customer mobile', DETAILS: 'Customer details', PAN: 'PAN', PINCODE: 'Residence pincode', EMPLOYMENT: 'Employment', INCOME: 'Annual income (as per ITR)', DECLARATIONS: 'Declarations & consent', REVIEW: 'Review & submit' };
const ORDER: LeadStep[] = ['MOBILE', 'DETAILS', 'PAN', 'PINCODE', 'EMPLOYMENT', 'INCOME', 'DECLARATIONS', 'REVIEW'];
const EMPLOYMENT: { key: string; label: string }[] = [
  { key: 'SALARIED', label: 'Salaried' },
  { key: 'SELF_EMPLOYED', label: 'Self employed' },
  { key: 'SELF_EMPLOYED_PROFESSIONAL', label: 'Self employed professional' },
];

/** F-406 S13–S20: server-side draft; each step PATCHes and the server decides the next step. Resumes by draftId. */
export default function LeadNew() {
  const { cardId, draftId } = useLocalSearchParams<{ cardId?: string; draftId?: string }>();
  const [d, setD] = useState<LeadDraftView | null>(null);
  const [editing, setEditing] = useState<LeadStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ mobile: '', override: '', fullName: '', email: '', pan: '', pincode: '', city: '', state: '', confirmed: false, employmentType: '', income: '', accepted: new Set<string>(), bureau: false });
  const [dup, setDup] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ district: string | null; state: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (draftId) setD((await api.get<LeadDraftView>(`/leads/drafts/${draftId}`)).data);
        else if (cardId) setD((await api.post<LeadDraftView>('/leads/drafts', { cardId })).data);
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : 'Could not start the lead.');
      }
    })();
  }, [cardId, draftId]);

  const patch = async (step: string, body: unknown) => {
    if (!d) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.patch<LeadDraftView>(`/leads/drafts/${d.id}/${step}`, body);
      setD(r.data);
      setEditing(null);
      setDup(null);
    } catch (e) {
      if (e instanceof ApiClientError && e.error.code === 'LEAD_DUPLICATE_REFERENCE') setDup(e.message);
      else setError(e instanceof ApiClientError ? e.message : 'Could not save this step.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!d) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ id: string; publicRef: string }>(`/leads/drafts/${d.id}/submit`, {});
      router.replace({ pathname: '/(advisor)/lead-created', params: { id: r.data.id, publicRef: r.data.publicRef, cardId: d.card.id, cardName: d.card.name, bankName: d.card.bank.displayName, customer: d.data.fullName ?? '' } });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not submit.');
    } finally {
      setBusy(false);
    }
  };

  if (!d) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }
  const step = editing ?? d.step;
  const idx = ORDER.indexOf(step);

  const body = () => {
    switch (step) {
      case 'MOBILE':
        return (
          <>
            <Label>Customer mobile</Label>
            <Input value={f.mobile} keyboardType="phone-pad" onChangeText={(t) => setF({ ...f, mobile: mobileInput(t) })} placeholder="10-digit mobile" />
            {dup ? (
              <>
                <Badge label="Possible duplicate" variant="warning" />
                <Muted>{dup}</Muted>
                <Label>Reason to continue anyway</Label>
                <Input value={f.override} onChangeText={(t) => setF({ ...f, override: t })} />
              </>
            ) : null}
            <Button title="Continue" disabled={busy || f.mobile.replace(/\D/g, '').length < 10 || (dup !== null && f.override.trim().length < 3)} onPress={() => void patch('mobile', dup ? { mobile: f.mobile, duplicateOverrideReason: f.override } : { mobile: f.mobile })} />
          </>
        );
      case 'DETAILS':
        return (
          <>
            <Label>Customer full name</Label>
            <Input value={f.fullName} onChangeText={(t) => setF({ ...f, fullName: t })} placeholder="As on PAN" />
            <Label>Email (optional)</Label>
            <Input value={f.email} autoCapitalize="none" keyboardType="email-address" onChangeText={(t) => setF({ ...f, email: t })} />
            <Button title="Continue" disabled={busy || f.fullName.trim().length < 2} onPress={() => void patch('details', { fullName: f.fullName.trim(), ...(f.email ? { email: f.email.trim() } : {}) })} />
          </>
        );
      case 'PAN':
        return (
          <>
            <Label>Customer PAN</Label>
            <Input value={f.pan} autoCapitalize="characters" maxLength={10} onChangeText={(t) => setF({ ...f, pan: panInput(t) })} placeholder="ABCDE1234F" />
            {d.data.panVerification ? <Badge label={`Verification: ${d.data.panVerification.status.toLowerCase()}`} variant={d.data.panVerification.status === 'VERIFIED' ? 'success' : 'destructive'} /> : null}
            <Muted>PAN is verified with the provider and stored encrypted; only the last four characters are shown afterwards.</Muted>
            <Button title="Verify and continue" disabled={busy || f.pan.length !== 10} onPress={() => void patch('pan', { pan: f.pan })} />
          </>
        );
      case 'PINCODE':
        return (
          <>
            <Label>Residence pincode</Label>
            <Input
              value={f.pincode}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(t) => {
                setF({ ...f, pincode: digitsOnly(t, 6) });
                setLookup(null);
                if (/^\d{6}$/.test(t)) void api.get<{ district: string | null; state: string | null }>(`/pincodes/${t}`).then((r) => setLookup(r.data)).catch(() => setLookup({ district: null, state: null }));
              }}
            />
            {lookup ? lookup.state ? <Muted>Resolved: {lookup.district}, {lookup.state}</Muted> : <Muted>Location unavailable for this pincode — enter city and state.</Muted> : null}
            {lookup && !lookup.state ? (
              <>
                <Label>City</Label>
                <Input value={f.city} onChangeText={(t) => setF({ ...f, city: t })} />
                <Label>State</Label>
                <Input value={f.state} onChangeText={(t) => setF({ ...f, state: t })} />
              </>
            ) : null}
            <View className="flex-row items-center justify-between">
              <Text>Customer confirms this city/state</Text>
              <Switch value={f.confirmed} onValueChange={(v) => setF({ ...f, confirmed: v })} />
            </View>
            <Button title="Continue" disabled={busy || !/^\d{6}$/.test(f.pincode)} onPress={() => void patch('pincode', { pincode: f.pincode, locationConfirmed: f.confirmed, ...(f.city ? { city: f.city } : {}), ...(f.state ? { state: f.state } : {}) })} />
          </>
        );
      case 'EMPLOYMENT':
        return (
          <>
            {EMPLOYMENT.map((e) => (
              <Pressable key={e.key} accessibilityRole="radio" accessibilityState={{ selected: f.employmentType === e.key }} onPress={() => setF({ ...f, employmentType: e.key })} className={`rounded-md border border-border p-3 ${f.employmentType === e.key ? 'bg-primary' : ''}`}>
                <Text className={f.employmentType === e.key ? 'text-primary-foreground' : ''}>{e.label}</Text>
              </Pressable>
            ))}
            <Button title="Continue" disabled={busy || !f.employmentType} onPress={() => void patch('employment', { employmentType: f.employmentType })} />
          </>
        );
      case 'INCOME':
        return (
          <>
            <Label>Annual income as per ITR (₹)</Label>
            <Input value={f.income} keyboardType="decimal-pad" onChangeText={(t) => setF({ ...f, income: amountInput(t) })} />
            <Button title="Continue" disabled={busy || !f.income || Number.isNaN(Number(f.income))} onPress={() => void patch('income', { annualIncomeItr: Number(f.income) })} />
          </>
        );
      case 'DECLARATIONS':
        return (
          <>
            {d.declarations.map((dec) => (
              <View key={dec.id} className="flex-row items-start justify-between gap-2">
                <Text className="flex-1">{dec.text}</Text>
                <Switch
                  value={f.accepted.has(dec.id)}
                  onValueChange={(v) => {
                    const s = new Set(f.accepted);
                    if (v) s.add(dec.id);
                    else s.delete(dec.id);
                    setF({ ...f, accepted: s });
                  }}
                />
              </View>
            ))}
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1">The customer acknowledges that the bank may perform a credit bureau check.</Text>
              <Switch value={f.bureau} onValueChange={(v) => setF({ ...f, bureau: v })} />
            </View>
            <Button title="Continue" disabled={busy || !f.bureau || d.declarations.some((x) => !f.accepted.has(x.id))} onPress={() => void patch('declarations', { acceptedDeclarationIds: [...f.accepted], bureauAcknowledged: true })} />
          </>
        );
      case 'REVIEW':
        return (
          <>
            <Text className="font-medium">
              {d.card.bank.displayName} {d.card.name}
            </Text>
            <Muted>
              {d.data.fullName} · {d.data.mobileMasked} · PAN {d.data.panMasked} ({d.data.panVerification?.status.toLowerCase()})
            </Muted>
            <Muted>
              {d.data.pincode} · {d.data.city ?? '—'}, {d.data.state ?? '—'}
              {d.data.locationConfirmed ? ' (confirmed)' : ''}
            </Muted>
            <Muted>
              {EMPLOYMENT.find((e) => e.key === d.data.employmentType)?.label} · ₹{d.data.annualIncomeItr?.toLocaleString('en-IN')}
            </Muted>
            <Muted>Declarations accepted · bureau acknowledged</Muted>
            <View className="flex-row flex-wrap gap-2">
              {(['MOBILE', 'DETAILS', 'PAN', 'PINCODE', 'EMPLOYMENT', 'INCOME'] as LeadStep[]).map((s) => (
                <Button key={s} title={`Edit ${TITLES[s].toLowerCase()}`} variant="ghost" onPress={() => setEditing(s)} />
              ))}
            </View>
            <Button title={busy ? 'Submitting…' : 'Submit lead'} disabled={busy} onPress={() => void submit()} />
            <Muted>This creates a KBS lead only; bank status will appear after MIS upload.</Muted>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-10">
        <View>
          <Heading>Create lead</Heading>
          <Muted>
            {d.card.bank.displayName} {d.card.name} · step {idx + 1} of {ORDER.length}
          </Muted>
          <View className="mt-2 flex-row gap-1">
            {ORDER.map((s, i) => (
              <View key={s} className={`h-1.5 flex-1 rounded-full ${i <= ORDER.indexOf(d.step) ? 'bg-primary' : 'bg-secondary'}`} />
            ))}
          </View>
        </View>
        <Card className="gap-2">
          <Text className="font-medium">{TITLES[step]}</Text>
          {editing ? <Button title="← Back to review" variant="ghost" onPress={() => setEditing(null)} /> : null}
          <ErrorText>{error}</ErrorText>
          {body()}
        </Card>
        <Button title="Save and exit (draft kept 7 days)" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
