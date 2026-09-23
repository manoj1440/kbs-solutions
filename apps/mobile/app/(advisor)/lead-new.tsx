import {
  amountInput,
  ApiClientError,
  digitsOnly,
  mobileInput,
  panInput,
  type LeadDraftView,
  type LeadStep,
} from '@kbs/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';

import { CreditCardArt } from '@/components/brand/credit-card-art';
import {
  AppBar,
  Appear,
  Badge,
  Button,
  Callout,
  Card,
  ChoiceRow,
  ErrorState,
  ErrorText,
  Icon,
  Input,
  Muted,
  Screen,
  Skeleton,
  StickyFooter,
  Stepper,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

const TITLES: Record<LeadStep, string> = {
  MOBILE: 'Customer mobile',
  DETAILS: 'Customer details',
  PAN: 'PAN',
  PINCODE: 'Residence pincode',
  EMPLOYMENT: 'Employment',
  INCOME: 'Annual income (as per ITR)',
  DECLARATIONS: 'Declarations & consent',
  REVIEW: 'Review & submit',
};
const ORDER: LeadStep[] = [
  'MOBILE',
  'DETAILS',
  'PAN',
  'PINCODE',
  'EMPLOYMENT',
  'INCOME',
  'DECLARATIONS',
  'REVIEW',
];
const EMPLOYMENT: { key: string; label: string }[] = [
  { key: 'SALARIED', label: 'Salaried' },
  { key: 'SELF_EMPLOYED', label: 'Self employed' },
  { key: 'SELF_EMPLOYED_PROFESSIONAL', label: 'Self employed professional' },
];

interface StepView {
  content: ReactNode;
  action: { title: string; disabled: boolean; onPress: () => void };
}

/** F-406 S13–S20: server-side draft; each step PATCHes and the server decides the next step. Resumes by draftId. */
export default function LeadNew() {
  const { cardId, draftId } = useLocalSearchParams<{ cardId?: string; draftId?: string }>();
  const [d, setD] = useState<LeadDraftView | null>(null);
  const [editing, setEditing] = useState<LeadStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    mobile: '',
    override: '',
    fullName: '',
    email: '',
    pan: '',
    pincode: '',
    city: '',
    state: '',
    confirmed: false,
    employmentType: '',
    income: '',
    accepted: new Set<string>(),
    bureau: false,
  });
  const [dup, setDup] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ district: string | null; state: string | null } | null>(
    null,
  );

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
      if (e instanceof ApiClientError && e.error.code === 'LEAD_DUPLICATE_REFERENCE')
        setDup(e.message);
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
      const r = await api.post<{ id: string; publicRef: string }>(
        `/leads/drafts/${d.id}/submit`,
        {},
      );
      router.replace({
        pathname: '/(advisor)/lead-created',
        params: {
          id: r.data.id,
          publicRef: r.data.publicRef,
          cardId: d.card.id,
          cardName: d.card.name,
          bankName: d.card.bank.displayName,
          customer: d.data.fullName ?? '',
        },
      });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not submit.');
    } finally {
      setBusy(false);
    }
  };

  if (!d) {
    return (
      <Screen scroll header={<AppBar title="Create lead" />}>
        {error ? (
          <ErrorState message={error} />
        ) : (
          <View accessibilityLabel="Loading" className="gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-52 w-full rounded-2xl" />
          </View>
        )}
      </Screen>
    );
  }
  const step = editing ?? d.step;
  const idx = ORDER.indexOf(step);

  const view = (): StepView | null => {
    switch (step) {
      case 'MOBILE':
        return {
          content: (
            <>
              <Input
                label="Customer mobile"
                icon="call-outline"
                value={f.mobile}
                keyboardType="phone-pad"
                onChangeText={(t) => setF({ ...f, mobile: mobileInput(t) })}
                placeholder="10-digit mobile"
              />
              {dup ? (
                <View className="gap-3">
                  <Callout kind="warning" title="Possible duplicate">
                    {dup}
                  </Callout>
                  <Input
                    label="Reason to continue anyway"
                    icon="create-outline"
                    value={f.override}
                    onChangeText={(t) => setF({ ...f, override: t })}
                  />
                </View>
              ) : null}
            </>
          ),
          action: {
            title: 'Continue',
            disabled:
              busy ||
              f.mobile.replace(/\D/g, '').length < 10 ||
              (dup !== null && f.override.trim().length < 3),
            onPress: () =>
              void patch(
                'mobile',
                dup
                  ? { mobile: f.mobile, duplicateOverrideReason: f.override }
                  : { mobile: f.mobile },
              ),
          },
        };
      case 'DETAILS':
        return {
          content: (
            <>
              <Input
                label="Customer full name"
                icon="person-outline"
                value={f.fullName}
                onChangeText={(t) => setF({ ...f, fullName: t })}
                placeholder="As on PAN"
              />
              <Input
                label="Email (optional)"
                icon="mail-outline"
                value={f.email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(t) => setF({ ...f, email: t })}
              />
            </>
          ),
          action: {
            title: 'Continue',
            disabled: busy || f.fullName.trim().length < 2,
            onPress: () =>
              void patch('details', {
                fullName: f.fullName.trim(),
                ...(f.email ? { email: f.email.trim() } : {}),
              }),
          },
        };
      case 'PAN':
        return {
          content: (
            <>
              <Input
                label="Customer PAN"
                icon="id-card-outline"
                value={f.pan}
                autoCapitalize="characters"
                maxLength={10}
                onChangeText={(t) => setF({ ...f, pan: panInput(t) })}
                placeholder="ABCDE1234F"
                inputClassName="tracking-[2px]"
              />
              {d.data.panVerification ? (
                <Badge
                  label={`Verification: ${d.data.panVerification.status.toLowerCase()}`}
                  variant={d.data.panVerification.status === 'VERIFIED' ? 'success' : 'destructive'}
                  icon={
                    d.data.panVerification.status === 'VERIFIED'
                      ? 'shield-checkmark'
                      : 'alert-circle'
                  }
                />
              ) : null}
              <Callout kind="neutral" icon="lock-closed">
                PAN is verified with the provider and stored encrypted; only the last four
                characters are shown afterwards.
              </Callout>
            </>
          ),
          action: {
            title: 'Verify and continue',
            disabled: busy || f.pan.length !== 10,
            onPress: () => void patch('pan', { pan: f.pan }),
          },
        };
      case 'PINCODE':
        return {
          content: (
            <>
              <Input
                label="Residence pincode"
                icon="location-outline"
                value={f.pincode}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(t) => {
                  setF({ ...f, pincode: digitsOnly(t, 6) });
                  setLookup(null);
                  if (/^\d{6}$/.test(t))
                    void api
                      .get<{ district: string | null; state: string | null }>(`/pincodes/${t}`)
                      .then((r) => setLookup(r.data))
                      .catch(() => setLookup({ district: null, state: null }));
                }}
              />
              {lookup ? (
                lookup.state ? (
                  <Callout kind="success" icon="navigate-circle">
                    {`Resolved: ${lookup.district}, ${lookup.state}`}
                  </Callout>
                ) : (
                  <Callout kind="warning">
                    Location unavailable for this pincode — enter city and state.
                  </Callout>
                )
              ) : null}
              {lookup && !lookup.state ? (
                <>
                  <Input
                    label="City"
                    icon="business-outline"
                    value={f.city}
                    onChangeText={(t) => setF({ ...f, city: t })}
                  />
                  <Input
                    label="State"
                    icon="map-outline"
                    value={f.state}
                    onChangeText={(t) => setF({ ...f, state: t })}
                  />
                </>
              ) : null}
              <ChoiceRow
                multi
                label="Customer confirms this city/state"
                selected={f.confirmed}
                onPress={() => setF({ ...f, confirmed: !f.confirmed })}
              />
            </>
          ),
          action: {
            title: 'Continue',
            disabled: busy || !/^\d{6}$/.test(f.pincode),
            onPress: () =>
              void patch('pincode', {
                pincode: f.pincode,
                locationConfirmed: f.confirmed,
                ...(f.city ? { city: f.city } : {}),
                ...(f.state ? { state: f.state } : {}),
              }),
          },
        };
      case 'EMPLOYMENT':
        return {
          content: (
            <View className="gap-2.5">
              {EMPLOYMENT.map((e) => (
                <ChoiceRow
                  key={e.key}
                  label={e.label}
                  selected={f.employmentType === e.key}
                  onPress={() => setF({ ...f, employmentType: e.key })}
                />
              ))}
            </View>
          ),
          action: {
            title: 'Continue',
            disabled: busy || !f.employmentType,
            onPress: () => void patch('employment', { employmentType: f.employmentType }),
          },
        };
      case 'INCOME':
        return {
          content: (
            <Input
              label="Annual income as per ITR (₹)"
              icon="cash-outline"
              prefix="₹"
              value={f.income}
              keyboardType="decimal-pad"
              onChangeText={(t) => setF({ ...f, income: amountInput(t) })}
            />
          ),
          action: {
            title: 'Continue',
            disabled: busy || !f.income || Number.isNaN(Number(f.income)),
            onPress: () => void patch('income', { annualIncomeItr: Number(f.income) }),
          },
        };
      case 'DECLARATIONS':
        return {
          content: (
            <View className="gap-2.5">
              {d.declarations.map((dec) => (
                <ChoiceRow
                  key={dec.id}
                  multi
                  label={dec.text}
                  selected={f.accepted.has(dec.id)}
                  onPress={() => {
                    const s = new Set(f.accepted);
                    if (s.has(dec.id)) s.delete(dec.id);
                    else s.add(dec.id);
                    setF({ ...f, accepted: s });
                  }}
                />
              ))}
              <ChoiceRow
                multi
                label="The customer acknowledges that the bank may perform a credit bureau check."
                selected={f.bureau}
                onPress={() => setF({ ...f, bureau: !f.bureau })}
              />
            </View>
          ),
          action: {
            title: 'Continue',
            disabled: busy || !f.bureau || d.declarations.some((x) => !f.accepted.has(x.id)),
            onPress: () =>
              void patch('declarations', {
                acceptedDeclarationIds: [...f.accepted],
                bureauAcknowledged: true,
              }),
          },
        };
      case 'REVIEW': {
        const rows: [LeadStep, string, string][] = [
          ['MOBILE', 'Mobile', d.data.mobileMasked ?? '—'],
          ['DETAILS', 'Name', d.data.fullName ?? '—'],
          [
            'PAN',
            'PAN',
            `${d.data.panMasked ?? '—'} (${d.data.panVerification?.status.toLowerCase() ?? '—'})`,
          ],
          [
            'PINCODE',
            'Residence',
            `${d.data.pincode ?? '—'} · ${d.data.city ?? '—'}, ${d.data.state ?? '—'}${d.data.locationConfirmed ? ' (confirmed)' : ''}`,
          ],
          [
            'EMPLOYMENT',
            'Employment',
            EMPLOYMENT.find((e) => e.key === d.data.employmentType)?.label ?? '—',
          ],
          [
            'INCOME',
            'Annual income (ITR)',
            `₹${d.data.annualIncomeItr?.toLocaleString('en-IN') ?? '—'}`,
          ],
        ];
        return {
          content: (
            <>
              <View>
                {rows.map(([s, label, value]) => (
                  <View key={s} className="flex-row items-center gap-3 border-b border-line py-3">
                    <View className="flex-1">
                      <Muted className="text-[12px]">{label}</Muted>
                      <RNText className="font-semibold text-[15px] text-ink">{value}</RNText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${TITLES[s].toLowerCase()}`}
                      hitSlop={8}
                      onPress={() => setEditing(s)}
                      className="h-9 flex-row items-center gap-1 rounded-full bg-[#E8EDFF] px-3"
                    >
                      <Icon name="create-outline" size={14} color={colors.brand} />
                      <RNText className="font-semibold text-[13px] text-brand">Edit</RNText>
                    </Pressable>
                  </View>
                ))}
                <View className="flex-row items-center gap-2 py-3">
                  <Icon name="checkmark-done-circle" size={18} color={colors.success} />
                  <Muted>Declarations accepted · bureau acknowledged</Muted>
                </View>
              </View>
              <Callout kind="info">
                This creates a KBS lead only; bank status will appear after MIS upload.
              </Callout>
            </>
          ),
          action: {
            title: busy ? 'Submitting…' : 'Submit lead',
            disabled: busy,
            onPress: () => void submit(),
          },
        };
      }
      default:
        return null;
    }
  };
  const v = view();

  return (
    <Screen
      scroll
      header={
        <AppBar
          title={editing ? `Edit ${TITLES[step].toLowerCase()}` : 'Create lead'}
          subtitle={`${d.card.bank.displayName} ${d.card.name}`}
        />
      }
      footer={
        v ? (
          <StickyFooter>
            <View className="flex-row gap-3">
              {editing ? (
                <Button
                  title="Back to review"
                  icon="arrow-back"
                  variant="outline"
                  className="flex-1"
                  onPress={() => setEditing(null)}
                />
              ) : (
                <Button
                  title="Save & exit"
                  variant="outline"
                  className="flex-1"
                  onPress={() => router.back()}
                />
              )}
              <Button
                title={v.action.title}
                loading={busy}
                disabled={v.action.disabled}
                className="flex-[2]"
                onPress={v.action.onPress}
              />
            </View>
          </StickyFooter>
        ) : null
      }
    >
      <Stepper steps={ORDER.map((s) => TITLES[s])} current={idx} />

      <Appear>
        <Card className="flex-row items-center gap-3.5 p-3">
          <CreditCardArt bank={d.card.bank.displayName} name={d.card.name} width={96} compact />
          <View className="flex-1">
            <Muted className="text-[12px]">Applying for</Muted>
            <RNText numberOfLines={1} className="font-bold text-[16px] text-ink">
              {d.card.name}
            </RNText>
            <Muted numberOfLines={1}>{d.card.bank.displayName}</Muted>
          </View>
        </Card>
      </Appear>

      <Appear index={1} key={step}>
        <Card className="gap-4 p-5">
          <View>
            <RNText
              accessibilityRole="header"
              className="font-extrabold text-[22px] tracking-tight text-ink"
            >
              {TITLES[step]}
            </RNText>
          </View>
          <ErrorText>{error}</ErrorText>
          {v?.content}
        </Card>
      </Appear>

      <View className="flex-row items-center justify-center gap-1.5">
        <Icon name="cloud-done-outline" size={14} color={colors.subtle} />
        <Muted className="text-[12px]">Save and exit anytime — the draft is kept 7 days.</Muted>
      </View>
    </Screen>
  );
}
