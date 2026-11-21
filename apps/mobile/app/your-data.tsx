import {
  ApiClientError,
  DATA_REQUEST_STATUS_LABEL,
  DATA_REQUEST_TARGET_DAYS,
  DATA_REQUEST_TYPE_LABEL,
  type DataRequestType,
  type DataRequestView,
  formatDate,
  type PersonalDataExport,
} from '@kbs/shared';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, Text as RNText, View } from 'react-native';

import {
  AppBar,
  Badge,
  BottomSheet,
  Button,
  Callout,
  Card,
  ErrorText,
  Input,
  ListItem,
  Screen,
  SectionHeader,
  SkeletonList,
} from '@/components/ui';
import { api } from '@/lib/api';
import { exportSummary, requestError, requestTone } from '@/lib/data-requests';
import { useSession } from '@/lib/session';

type SheetKind = DataRequestType;

const SHEET: Record<SheetKind, { title: string; intro: string; label?: string; placeholder?: string; submit: string }> = {
  CORRECTION: {
    title: 'Correct my data',
    intro: 'Tell KBS what is wrong and what it should be. Staff check it and reply here.',
    label: 'What should change',
    placeholder: 'For example: my email should be …',
    submit: 'Send correction request',
  },
  GRIEVANCE: {
    title: 'Raise a grievance',
    intro: 'Tell the Grievance Officer what went wrong with how KBS handles your data.',
    label: 'Your grievance',
    placeholder: 'What happened and when',
    submit: 'Send grievance',
  },
  ACCESS: {
    title: 'Ask for a summary',
    intro: 'KBS staff send you a written summary of your data, how it is used and who it is shared with. For the data itself, use "Get a copy of my data".',
    label: 'Anything specific (optional)',
    placeholder: 'Optional',
    submit: 'Send request',
  },
  ERASURE: {
    title: 'Delete my account',
    intro:
      'KBS staff will contact you, close your account and delete what the law allows. Payout, tax and audit records are kept for as long as the law requires, and leads you created stay with the bank. This cannot be undone once it is carried out.',
    label: 'Reason (optional)',
    placeholder: 'Optional',
    submit: 'Ask to delete my account',
  },
};

/**
 * F-908 "Your data" (DPDP Act 2023 ss.11-13): download a copy of your own data, see your requests and file new ones.
 * Reachable from every role's profile; no onboarding or training gate stands in front of it.
 */
export default function YourData() {
  const { status } = useSession();
  const [rows, setRows] = useState<DataRequestView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      setRows((await api.get<DataRequestView[]>('/privacy/requests/mine')).data);
    } catch (e) {
      setLoadError(e instanceof ApiClientError ? e.message : 'Could not load your requests.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (status === 'signed-out') return <Redirect href="/(auth)/welcome" />;

  const active = (t: DataRequestType) => rows?.find((r) => r.type === t && (r.status === 'OPEN' || r.status === 'IN_PROGRESS'));

  const download = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const x = (await api.get<PersonalDataExport>('/privacy/me/export')).data;
      await Share.share({ title: 'My KBS data', message: JSON.stringify(x, null, 2) });
      setNotice({ kind: 'success', text: `Your copy is ready: ${exportSummary(x)}. PAN and bank numbers show the last 4 digits only.` });
    } catch (e) {
      setNotice({ kind: 'danger', text: e instanceof ApiClientError ? e.message : 'Could not prepare your copy. Check your connection and try again.' });
    } finally {
      setExporting(false);
    }
  };

  const open = (k: SheetKind) => {
    setDetails('');
    setFormError(null);
    setSheet(k);
  };

  const submit = async () => {
    if (!sheet) return;
    const err = requestError(sheet, details);
    if (err) return setFormError(err);
    setBusy(true);
    setFormError(null);
    try {
      const r = await api.post<DataRequestView>('/privacy/requests', { type: sheet, details: details.trim() || undefined });
      setSheet(null);
      setNotice({ kind: 'success', text: `Request ${r.data.publicRef} sent. KBS aims to reply within ${DATA_REQUEST_TARGET_DAYS} days.` });
      await load();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const s = sheet ? SHEET[sheet] : null;
  const requestRow = (t: SheetKind, icon: Parameters<typeof ListItem>[0]['icon'], subtitle: string, last?: boolean) => {
    const a = active(t);
    return (
      <ListItem
        icon={icon}
        title={SHEET[t].title}
        subtitle={a ? `Already sent: ${a.publicRef}` : subtitle}
        destructive={t === 'ERASURE'}
        onPress={a ? undefined : () => open(t)}
        chevron={!a}
        last={last}
      />
    );
  };

  return (
    <Screen scroll header={<AppBar title="Your data" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}>
      <View className="gap-5 pb-8">
        <Card className="gap-3 p-4">
          <RNText className="font-medium text-lg text-ink">Get a copy of your data</RNText>
          <RNText className="font-normal text-md text-[#525252]">
            Your profile, payee details, leads by reference, payout requests and sign-ins, as a file
            you can save or send. Customers on your leads are shown by reference only.
          </RNText>
          <Button title="Get a copy of my data" variant="gold" size="lg" icon="download-outline" loading={exporting} disabled={exporting} onPress={() => void download()} />
          <RNText className="font-normal text-sm text-[#737373]">
            You can also download it from your account page on the KBS website.
          </RNText>
        </Card>

        {notice ? <Callout kind={notice.kind}>{notice.text}</Callout> : null}

        <View className="gap-3">
          <SectionHeader title="Ask KBS" />
          <Card className="px-4 py-1">
            {requestRow('CORRECTION', 'create-outline', 'Something about you is wrong')}
            {requestRow('ACCESS', 'reader-outline', 'A written summary of how your data is used')}
            {requestRow('GRIEVANCE', 'chatbubble-ellipses-outline', 'A complaint about how your data is handled')}
            {requestRow('ERASURE', 'trash-outline', 'Close your account and delete your data', true)}
          </Card>
        </View>

        <View className="gap-3">
          <SectionHeader title="Your requests" />
          {loadError ? (
            <Callout kind="danger" title="Could not load your requests">
              {loadError}
            </Callout>
          ) : !rows ? (
            <SkeletonList rows={2} />
          ) : rows.length === 0 ? (
            <RNText className="px-1 font-normal text-md text-[#525252]">No requests yet. Anything you send appears here with its status.</RNText>
          ) : (
            rows.map((r) => (
              <Card key={r.id} className="gap-2 p-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <RNText className="font-medium text-base text-ink">{DATA_REQUEST_TYPE_LABEL[r.type]}</RNText>
                    <RNText selectable className="mt-0.5 font-normal text-sm text-[#737373] tabular-nums">
                      {r.publicRef}, sent {formatDate(r.createdAt)}
                    </RNText>
                  </View>
                  <Badge label={DATA_REQUEST_STATUS_LABEL[r.status]} variant={requestTone(r.status)} dot />
                </View>
                {r.resolutionNote ? (
                  <View className="rounded-lg bg-raised p-3">
                    <RNText className="font-medium text-sm text-ink">Reply from KBS{r.closedAt ? `, ${formatDate(r.closedAt)}` : ''}</RNText>
                    <RNText selectable className="mt-1 font-normal text-md text-[#3F3A34]">
                      {r.resolutionNote}
                    </RNText>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </View>
      </View>

      <BottomSheet
        open={sheet !== null}
        onClose={() => (busy ? undefined : setSheet(null))}
        title={s?.title}
        footer={
          s ? (
            <Button
              title={s.submit}
              size="lg"
              variant={sheet === 'ERASURE' ? 'destructive' : 'default'}
              loading={busy}
              disabled={busy}
              onPress={() => void submit()}
            />
          ) : null
        }
      >
        {s ? (
          <View className="gap-4">
            <RNText className="font-normal text-md text-[#525252]">{s.intro}</RNText>
            <Input label={s.label} value={details} onChangeText={setDetails} placeholder={s.placeholder} multiline maxLength={2000} />
            <ErrorText>{formError}</ErrorText>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
