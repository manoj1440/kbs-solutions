import {
  agentCodeInput,
  ApiClientError,
  digitsOnly,
  formatDateTime,
  ifscInput,
  type OnboardingView,
} from '@kbs/shared';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Text as RNText, View } from 'react-native';

import {
  AppBar,
  Appear,
  Badge,
  Button,
  Callout,
  Card,
  ErrorState,
  ErrorText,
  IconCircle,
  type IconName,
  Input,
  KeyValue,
  ListItem,
  Muted,
  Screen,
  Skeleton,
  StickyFooter,
  Stepper,
  Text,
} from '@/components/ui';
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
const STEP_ICONS: Record<string, IconName> = {
  PERSONAL: 'person',
  CONSENT: 'shield-checkmark',
  IDENTITY: 'finger-print',
  BANK: 'business',
  CHEQUE: 'document-attach',
  AGENT_CODE: 'people',
  REVIEW: 'checkmark-done',
  AWAITING_REVIEW: 'hourglass',
  COMPLETE: 'checkmark-circle',
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
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    accountHolderName: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    code: '',
    payload: '',
  });
  const [kyc, setKyc] = useState<{ sessionRef: string; instructions: string } | null>(null);
  const [codeCheck, setCodeCheck] = useState<'valid' | 'invalid' | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<OnboardingView>('/onboarding/me');
      setV(r.data);
      setForm((f) => ({
        ...f,
        fullName: r.data.personal.fullName || f.fullName,
        email: r.data.personal.email ?? f.email,
        accountHolderName: r.data.bank?.accountHolderName ?? f.accountHolderName,
        ifsc: r.data.bank?.ifsc ?? f.ifsc,
        bankName: r.data.bank?.bankName ?? f.bankName,
      }));
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

  const signOutButton = (
    <Button
      title="Sign out"
      size="sm"
      variant="ghost"
      icon="log-out-outline"
      onPress={() => void signOut()}
    />
  );

  if (!v) {
    return (
      <Screen
        scroll
        header={<AppBar title="Advisor onboarding" back={false} right={signOutButton} />}
      >
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null);
              void load();
            }}
          />
        ) : (
          <View className="gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-56 w-full rounded-3xl" />
          </View>
        )}
      </Screen>
    );
  }
  const step = editing ?? v.step;
  const progressIdx = PROGRESS.indexOf(
    v.step === 'AWAITING_REVIEW' || v.step === 'COMPLETE' ? 'REVIEW' : v.step,
  );
  const stepperIdx = Math.max(0, progressIdx);
  const stepperLabels = PROGRESS.map((s, i) =>
    i === stepperIdx ? (STEP_TITLES[v.step] ?? s) : (STEP_TITLES[s] ?? s),
  );

  /** Each step: body content + its primary action (rendered in the sticky footer). */
  const stepBody = (): { body: ReactNode; action?: ReactNode } => {
    switch (step) {
      case 'PERSONAL':
        return {
          body: (
            <>
              <Input
                label="Full name"
                icon="person-outline"
                value={form.fullName}
                onChangeText={(t) => setForm({ ...form, fullName: t })}
                placeholder="As on your bank account"
              />
              <Input
                label="Email"
                icon="mail-outline"
                value={form.email}
                onChangeText={(t) => setForm({ ...form, email: t })}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
            </>
          ),
          action: (
            <Button
              title="Continue"
              size="lg"
              iconRight="arrow-forward"
              loading={busy}
              disabled={busy || form.fullName.trim().length < 2 || !form.email.includes('@')}
              onPress={() =>
                void run(() =>
                  api.put('/onboarding/me/personal', {
                    fullName: form.fullName.trim(),
                    email: form.email.trim(),
                  }),
                )
              }
            />
          ),
        };
      case 'CONSENT':
        return {
          body: (
            <>
              <Text className="text-[15px] leading-[23px]">
                KBS Solutions will verify your identity through an authorised provider and keep only
                the verification result — never your identity number, documents or images.
              </Text>
              <Callout kind="neutral" icon="lock-closed">
                {`Privacy notice ${v.privacyNoticeVersion}. Your bank details and cancelled cheque are used only for payouts and are visible to authorised KBS staff, with every access logged.`}
              </Callout>
            </>
          ),
          action: (
            <Button
              title="I consent and accept the terms"
              size="lg"
              icon="checkmark-circle"
              loading={busy}
              disabled={busy}
              onPress={() =>
                void run(() =>
                  api.put('/onboarding/me/consent', {
                    privacyNoticeVersion: v.privacyNoticeVersion,
                    identityConsent: true,
                    termsAccepted: true,
                  }),
                )
              }
            />
          ),
        };
      case 'IDENTITY':
        return {
          body: (
            <>
              <Badge
                label={`Status: ${v.identity.status.toLowerCase().replace('_', ' ')}`}
                variant={
                  v.identity.status === 'VERIFIED'
                    ? 'success'
                    : v.identity.status === 'FAILED'
                      ? 'destructive'
                      : 'info'
                }
                dot
              />
              {v.identity.status === 'VERIFIED' ? (
                <Muted>
                  Verified on {v.identity.verifiedAt ? formatDateTime(v.identity.verifiedAt) : '—'}{' '}
                  via {v.identity.provider}.
                </Muted>
              ) : !kyc ? (
                <Callout kind="info" icon="shield-checkmark">
                  Verification is done by an authorised provider using a lawful offline method.
                  Nothing identity-related is typed into this app.
                </Callout>
              ) : (
                <>
                  <Muted>{kyc.instructions}</Muted>
                  <Input
                    label="Provider response"
                    icon="key-outline"
                    value={form.payload}
                    onChangeText={(t) => setForm({ ...form, payload: t })}
                    placeholder="Paste the provider's completion code"
                    autoCapitalize="none"
                  />
                </>
              )}
            </>
          ),
          action:
            v.identity.status === 'VERIFIED' ? undefined : !kyc ? (
              <Button
                title={v.identity.status === 'FAILED' ? 'Try again' : 'Start verification'}
                size="lg"
                icon="finger-print"
                loading={busy}
                disabled={busy}
                onPress={() =>
                  void run(async () =>
                    setKyc(
                      (await api.post<OnboardingView>('/onboarding/me/identity/start', {})).data
                        .identity as { sessionRef: string; instructions: string },
                    ),
                  )
                }
              />
            ) : (
              <Button
                title="Complete verification"
                size="lg"
                icon="checkmark-circle"
                loading={busy}
                disabled={busy || !form.payload}
                onPress={() =>
                  void run(async () => {
                    await api.post('/onboarding/me/identity/complete', {
                      sessionRef: kyc.sessionRef,
                      payload: form.payload,
                    });
                    setKyc(null);
                  })
                }
              />
            ),
        };
      case 'BANK':
        return {
          body: (
            <>
              <Input
                label="Account holder name"
                icon="person-outline"
                value={form.accountHolderName}
                onChangeText={(t) => setForm({ ...form, accountHolderName: t })}
              />
              <Input
                label="Account number"
                icon="card-outline"
                value={form.accountNumber}
                onChangeText={(t) => setForm({ ...form, accountNumber: digitsOnly(t, 18) })}
                keyboardType="number-pad"
                placeholder={v.bank ? `•••• ${v.bank.accountLast4} (enter again to change)` : ''}
                hint="9–18 digits"
              />
              <Input
                label="IFSC"
                icon="git-branch-outline"
                value={form.ifsc}
                onChangeText={(t) => setForm({ ...form, ifsc: ifscInput(t) })}
                autoCapitalize="characters"
                maxLength={11}
                hint="11 characters"
              />
              <Input
                label="Bank name"
                icon="business-outline"
                value={form.bankName}
                onChangeText={(t) => setForm({ ...form, bankName: t })}
              />
            </>
          ),
          action: (
            <Button
              title="Save bank details"
              size="lg"
              icon="save-outline"
              loading={busy}
              disabled={
                busy ||
                form.accountNumber.length < 9 ||
                form.ifsc.length !== 11 ||
                form.accountHolderName.trim().length < 2 ||
                form.bankName.trim().length < 2
              }
              onPress={() =>
                void run(() =>
                  api.put('/onboarding/me/bank', {
                    accountHolderName: form.accountHolderName.trim(),
                    accountNumber: form.accountNumber,
                    ifsc: form.ifsc,
                    bankName: form.bankName.trim(),
                  }),
                )
              }
            />
          ),
        };
      case 'CHEQUE':
        return {
          body: (
            <>
              <Text className="text-[15px] leading-[23px]">
                Upload a photo of a cancelled cheque for the account above.
              </Text>
              {v.cheque ? (
                <View className="flex-row items-center gap-3 rounded-2xl bg-canvas p-3">
                  <IconCircle icon="image" tone="success" size={40} />
                  <View className="flex-1">
                    <Muted className="text-[12px]">Uploaded</Muted>
                    <RNText numberOfLines={1} className="font-semibold text-[14px] text-ink">
                      {v.cheque.originalName}
                    </RNText>
                  </View>
                </View>
              ) : (
                <View className="items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#CBD2E1] bg-canvas px-4 py-7">
                  <IconCircle icon="camera-outline" size={48} />
                  <Muted className="text-center">No cheque image yet</Muted>
                </View>
              )}
            </>
          ),
          action: (
            <Button
              title={v.cheque ? 'Replace cheque image' : 'Choose cheque image'}
              size="lg"
              variant="outline"
              icon="images-outline"
              loading={busy}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const res = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.8,
                  });
                  if (res.canceled || !res.assets[0]) return;
                  const a = res.assets[0];
                  const fd = new FormData();
                  fd.append('file', {
                    uri: a.uri,
                    name: a.fileName ?? 'cheque.jpg',
                    type: a.mimeType ?? 'image/jpeg',
                  } as unknown as Blob);
                  const up = await api.post<{ id: string }>('/files/cheque', fd);
                  await api.put('/onboarding/me/cheque', { fileId: up.data.id });
                })
              }
            />
          ),
        };
      case 'AGENT_CODE':
        return {
          body: (
            <>
              <Text className="text-[15px] leading-[23px]">
                If a KBS Manager gave you an Agent Code, enter it to report to them. Leave blank to
                report to KBS directly. Earlier leads always keep their original attribution.
              </Text>
              <Input
                label="Agent Code"
                icon="pricetag-outline"
                value={form.code}
                autoCapitalize="characters"
                onChangeText={(t) => {
                  setForm({ ...form, code: agentCodeInput(t) });
                  setCodeCheck(null);
                }}
                onBlur={() => {
                  if (form.code.length >= 4)
                    void api
                      .get<{ valid: boolean }>(
                        `/agent-codes/validate?code=${encodeURIComponent(form.code)}`,
                      )
                      .then((r) => setCodeCheck(r.data.valid ? 'valid' : 'invalid'))
                      .catch(() => setCodeCheck('invalid'));
                }}
              />
              {codeCheck ? (
                <Badge
                  label={codeCheck === 'valid' ? 'Code recognised' : 'Code not valid'}
                  variant={codeCheck === 'valid' ? 'success' : 'destructive'}
                  icon={codeCheck === 'valid' ? 'checkmark-circle' : 'close-circle'}
                />
              ) : null}
            </>
          ),
          action: (
            <Button
              title={form.code ? 'Apply code and continue' : 'Skip — report to KBS'}
              size="lg"
              variant={form.code ? 'default' : 'outline'}
              iconRight="arrow-forward"
              loading={busy}
              disabled={busy || (form.code.length > 0 && form.code.length < 4)}
              onPress={() =>
                void run(() =>
                  api.put('/onboarding/me/agent-code', form.code ? { code: form.code } : {}),
                )
              }
            />
          ),
        };
      case 'REVIEW':
        return {
          body: (
            <>
              {v.review?.outcome === 'REJECTED' ? (
                <Callout kind="danger" title="Changes requested">
                  {v.review.reason ?? ''}
                </Callout>
              ) : null}
              <View className="rounded-2xl bg-canvas px-4 py-1">
                <KeyValue label="Name" value={v.personal.fullName} />
                <KeyValue label="Email" value={v.personal.email ?? ''} />
                <KeyValue label="Identity" value={v.identity.status.toLowerCase()} />
                <KeyValue
                  label="Bank"
                  value={`${v.bank?.bankName ?? ''} ·••••${v.bank?.accountLast4 ?? ''} · ${v.bank?.ifsc ?? ''}`}
                />
                <KeyValue label="Cheque" value={v.cheque?.originalName ?? 'missing'} />
                <KeyValue label="Reporting to" value={v.reportingParent?.fullName ?? 'KBS'} last />
              </View>
              <View>
                <RNText className="mb-1 font-semibold text-[11px] uppercase tracking-[1.2px] text-[#8A93A6]">
                  Make changes
                </RNText>
                {['PERSONAL', 'BANK', 'CHEQUE', 'AGENT_CODE'].map((s, i, arr) => (
                  <ListItem
                    key={s}
                    icon={STEP_ICONS[s]}
                    title={`Edit ${(STEP_TITLES[s] ?? s).toLowerCase()}`}
                    onPress={() => setEditing(s)}
                    last={i === arr.length - 1}
                  />
                ))}
              </View>
              <Muted className="text-center text-[12px]">
                {v.requiresAdminReview
                  ? 'KBS reviews every new Advisor before activation.'
                  : 'Your account activates immediately after submission.'}
              </Muted>
            </>
          ),
          action: (
            <Button
              title={busy ? 'Submitting…' : 'Submit for review'}
              size="lg"
              icon="paper-plane"
              loading={busy}
              disabled={busy}
              onPress={() => void run(() => api.post('/onboarding/me/submit', {}))}
            />
          ),
        };
      case 'AWAITING_REVIEW':
        return {
          body: (
            <>
              <View className="flex-row justify-center">
                <Badge label="Awaiting KBS review" variant="info" icon="time-outline" />
              </View>
              <Text className="text-center text-[15px] leading-[23px]">
                Submitted {v.submittedAt ? formatDateTime(v.submittedAt) : ''}. You will be notified
                when your account is ready.
              </Text>
            </>
          ),
          action: (
            <Button
              title="Refresh"
              size="lg"
              variant="outline"
              icon="refresh"
              loading={busy}
              onPress={() => void run(async () => undefined)}
            />
          ),
        };
      default:
        return { body: <Text>Onboarding complete.</Text> };
    }
  };

  const { body, action } = stepBody();

  return (
    <Screen
      scroll
      header={
        <View className="border-b border-line bg-canvas pb-3">
          <AppBar
            title="Advisor onboarding"
            subtitle="A few steps to start earning"
            back={false}
            right={signOutButton}
          />
          <View className="px-4">
            <Stepper steps={stepperLabels} current={stepperIdx} />
          </View>
        </View>
      }
      footer={action ? <StickyFooter>{action}</StickyFooter> : null}
      contentClassName="pt-4"
    >
      <Appear key={step}>
        <Card className="gap-4 p-5">
          <View className="flex-row items-center gap-3">
            <IconCircle icon={STEP_ICONS[step] ?? 'ellipse'} size={44} />
            <View className="flex-1">
              <RNText accessibilityRole="header" className="font-bold text-[18px] text-ink">
                {STEP_TITLES[step]}
              </RNText>
              {editing ? <Muted className="text-[12px]">Editing an earlier step</Muted> : null}
            </View>
          </View>
          {editing ? (
            <Button
              title="Back to review"
              size="sm"
              variant="secondary"
              icon="arrow-back"
              className="self-start"
              onPress={() => setEditing(null)}
            />
          ) : null}
          <ErrorText>{error}</ErrorText>
          {body}
        </Card>
      </Appear>
    </Screen>
  );
}
