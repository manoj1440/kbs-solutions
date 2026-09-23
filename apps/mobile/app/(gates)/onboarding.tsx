import { agentCodeInput, ApiClientError, digitsOnly, formatDateTime, ifscInput, type OnboardingView } from '@kbs/shared';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Input, Label, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const STEP_TITLES: Record<string, string> = {
  PERSONAL: 'Your details',
  CONSENT: 'Consent & privacy',
  IDENTITY: 'Identity verification',
  BANK: 'Bank details',
  CHEQUE: 'Cancelled cheque',
  AGENT_CODE: 'Agent Code (optional)',
  REVIEW: 'Review & submit',
  AWAITING_REVIEW: 'Awaiting KBS review',
  COMPLETE: 'Done',
};
const PROGRESS = ['PERSONAL', 'CONSENT', 'IDENTITY', 'BANK', 'CHEQUE', 'AGENT_CODE', 'REVIEW'];

/**
 * F-401 / F-402: resumable onboarding wizard (S06–S07 happen in (auth)). The server decides the current step; this screen
 * renders that step, and the user can revisit earlier ones. No Aadhaar data is ever entered here — the provider handles it.
 */
export default function OnboardingGate() {
  const { signOut, refresh } = useSession();
  const [v, setV] = useState<OnboardingView | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', accountHolderName: '', accountNumber: '', ifsc: '', bankName: '', code: '', payload: '' });
  const [kyc, setKyc] = useState<{ sessionRef: string; instructions: string } | null>(null);
  const [codeCheck, setCodeCheck] = useState<'valid' | 'invalid' | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<OnboardingView>('/onboarding/me');
      setV(r.data);
      setForm((f) => ({ ...f, fullName: r.data.personal.fullName || f.fullName, email: r.data.personal.email ?? f.email, accountHolderName: r.data.bank?.accountHolderName ?? f.accountHolderName, ifsc: r.data.bank?.ifsc ?? f.ifsc, bankName: r.data.bank?.bankName ?? f.bankName }));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load onboarding.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setEditing(null);
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!v) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </Screen>
    );
  }
  const step = editing ?? v.step;
  const progressIdx = PROGRESS.indexOf(v.step === 'AWAITING_REVIEW' || v.step === 'COMPLETE' ? 'REVIEW' : v.step);

  const stepBody = () => {
    switch (step) {
      case 'PERSONAL':
        return (
          <>
            <Label>Full name</Label>
            <Input value={form.fullName} onChangeText={(t) => setForm({ ...form, fullName: t })} placeholder="As on your bank account" />
            <Label>Email</Label>
            <Input value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} autoCapitalize="none" keyboardType="email-address" />
            <Button title="Continue" disabled={busy || form.fullName.trim().length < 2 || !form.email.includes('@')} onPress={() => void run(() => api.put('/onboarding/me/personal', { fullName: form.fullName.trim(), email: form.email.trim() }))} />
          </>
        );
      case 'CONSENT':
        return (
          <>
            <Text>KBS Solutions will verify your identity through an authorised provider and keep only the verification result — never your identity number, documents or images.</Text>
            <Muted>Privacy notice {v.privacyNoticeVersion}. Your bank details and cancelled cheque are used only for payouts and are visible to authorised KBS staff, with every access logged.</Muted>
            <Button title="I consent and accept the terms" disabled={busy} onPress={() => void run(() => api.put('/onboarding/me/consent', { privacyNoticeVersion: v.privacyNoticeVersion, identityConsent: true, termsAccepted: true }))} />
          </>
        );
      case 'IDENTITY':
        return (
          <>
            <Badge label={`Status: ${v.identity.status.toLowerCase().replace('_', ' ')}`} variant={v.identity.status === 'VERIFIED' ? 'success' : v.identity.status === 'FAILED' ? 'destructive' : 'info'} />
            {v.identity.status === 'VERIFIED' ? (
              <Muted>Verified on {v.identity.verifiedAt ? formatDateTime(v.identity.verifiedAt) : '—'} via {v.identity.provider}.</Muted>
            ) : !kyc ? (
              <>
                <Text>Verification is done by an authorised provider using a lawful offline method. Nothing identity-related is typed into this app.</Text>
                <Button title={v.identity.status === 'FAILED' ? 'Try again' : 'Start verification'} disabled={busy} onPress={() => void run(async () => setKyc((await api.post<OnboardingView>('/onboarding/me/identity/start', {})).data.identity as { sessionRef: string; instructions: string }))} />
              </>
            ) : (
              <>
                <Muted>{kyc.instructions}</Muted>
                <Label>Provider response</Label>
                <Input value={form.payload} onChangeText={(t) => setForm({ ...form, payload: t })} placeholder="Paste the provider's completion code" autoCapitalize="none" />
                <Button
                  title="Complete verification"
                  disabled={busy || !form.payload}
                  onPress={() =>
                    void run(async () => {
                      await api.post('/onboarding/me/identity/complete', { sessionRef: kyc.sessionRef, payload: form.payload });
                      setKyc(null);
                    })
                  }
                />
              </>
            )}
          </>
        );
      case 'BANK':
        return (
          <>
            <Label>Account holder name</Label>
            <Input value={form.accountHolderName} onChangeText={(t) => setForm({ ...form, accountHolderName: t })} />
            <Label>Account number</Label>
            <Input value={form.accountNumber} onChangeText={(t) => setForm({ ...form, accountNumber: digitsOnly(t, 18) })} keyboardType="number-pad" placeholder={v.bank ? `•••• ${v.bank.accountLast4} (enter again to change)` : ''} />
            <Label>IFSC</Label>
            <Input value={form.ifsc} onChangeText={(t) => setForm({ ...form, ifsc: ifscInput(t) })} autoCapitalize="characters" maxLength={11} />
            <Label>Bank name</Label>
            <Input value={form.bankName} onChangeText={(t) => setForm({ ...form, bankName: t })} />
            <Button title="Save bank details" disabled={busy || form.accountNumber.length < 9 || form.ifsc.length !== 11 || form.accountHolderName.trim().length < 2 || form.bankName.trim().length < 2} onPress={() => void run(() => api.put('/onboarding/me/bank', { accountHolderName: form.accountHolderName.trim(), accountNumber: form.accountNumber, ifsc: form.ifsc, bankName: form.bankName.trim() }))} />
          </>
        );
      case 'CHEQUE':
        return (
          <>
            <Text>Upload a photo of a cancelled cheque for the account above.</Text>
            {v.cheque ? <Muted>Uploaded: {v.cheque.originalName}</Muted> : null}
            <Button
              title={v.cheque ? 'Replace cheque image' : 'Choose cheque image'}
              variant="outline"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
                  if (res.canceled || !res.assets[0]) return;
                  const a = res.assets[0];
                  const fd = new FormData();
                  fd.append('file', { uri: a.uri, name: a.fileName ?? 'cheque.jpg', type: a.mimeType ?? 'image/jpeg' } as unknown as Blob);
                  const up = await api.post<{ id: string }>('/files/cheque', fd);
                  await api.put('/onboarding/me/cheque', { fileId: up.data.id });
                })
              }
            />
          </>
        );
      case 'AGENT_CODE':
        return (
          <>
            <Text>If a KBS Manager gave you an Agent Code, enter it to report to them. Leave blank to report to KBS directly. Earlier leads always keep their original attribution.</Text>
            <Label>Agent Code</Label>
            <Input
              value={form.code}
              autoCapitalize="characters"
              onChangeText={(t) => {
                setForm({ ...form, code: agentCodeInput(t) });
                setCodeCheck(null);
              }}
              onBlur={() => {
                if (form.code.length >= 4) void api.get<{ valid: boolean }>(`/agent-codes/validate?code=${encodeURIComponent(form.code)}`).then((r) => setCodeCheck(r.data.valid ? 'valid' : 'invalid')).catch(() => setCodeCheck('invalid'));
              }}
            />
            {codeCheck ? <Badge label={codeCheck === 'valid' ? 'Code recognised' : 'Code not valid'} variant={codeCheck === 'valid' ? 'success' : 'destructive'} /> : null}
            <Button title={form.code ? 'Apply code and continue' : 'Skip — report to KBS'} disabled={busy || (form.code.length > 0 && form.code.length < 4)} onPress={() => void run(() => api.put('/onboarding/me/agent-code', form.code ? { code: form.code } : {}))} />
          </>
        );
      case 'REVIEW':
        return (
          <>
            {v.review?.outcome === 'REJECTED' ? <Badge label={`Changes requested: ${v.review.reason ?? ''}`} variant="destructive" /> : null}
            <Text>{v.personal.fullName}</Text>
            <Muted>{v.personal.email}</Muted>
            <Muted>Identity: {v.identity.status.toLowerCase()}</Muted>
            <Muted>
              Bank: {v.bank?.bankName} ·••••{v.bank?.accountLast4} · {v.bank?.ifsc}
            </Muted>
            <Muted>Cheque: {v.cheque?.originalName ?? 'missing'}</Muted>
            <Muted>Reporting to: {v.reportingParent?.fullName ?? 'KBS'}</Muted>
            <View className="flex-row flex-wrap gap-2">
              {['PERSONAL', 'BANK', 'CHEQUE', 'AGENT_CODE'].map((s) => (
                <Button key={s} title={`Edit ${(STEP_TITLES[s] ?? s).toLowerCase()}`} variant="ghost" onPress={() => setEditing(s)} />
              ))}
            </View>
            <Button title={busy ? 'Submitting…' : 'Submit for review'} disabled={busy} onPress={() => void run(() => api.post('/onboarding/me/submit', {}))} />
            <Muted>{v.requiresAdminReview ? 'KBS reviews every new Advisor before activation.' : 'Your account activates immediately after submission.'}</Muted>
          </>
        );
      case 'AWAITING_REVIEW':
        return (
          <>
            <Badge label="Awaiting KBS review" variant="info" />
            <Text>Submitted {v.submittedAt ? formatDateTime(v.submittedAt) : ''}. You will be notified when your account is ready.</Text>
            <Button title="Refresh" variant="outline" onPress={() => void run(async () => undefined)} />
          </>
        );
      default:
        return <Text>Onboarding complete.</Text>;
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-10">
        <View>
          <Heading>Advisor onboarding</Heading>
          <Muted>
            Step {Math.max(1, progressIdx + 1)} of {PROGRESS.length} · {STEP_TITLES[v.step]}
          </Muted>
          <View className="mt-2 flex-row gap-1">
            {PROGRESS.map((s, i) => (
              <View key={s} className={`h-1.5 flex-1 rounded-full ${i <= progressIdx ? 'bg-primary' : 'bg-secondary'}`} />
            ))}
          </View>
        </View>
        <Card className="gap-2">
          <Text className="font-medium">{STEP_TITLES[step]}</Text>
          {editing ? <Button title="← Back to review" variant="ghost" onPress={() => setEditing(null)} /> : null}
          <ErrorText>{error}</ErrorText>
          {stepBody()}
        </Card>
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  );
}
