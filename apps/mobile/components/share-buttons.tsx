import { ApiClientError, type ShareBody, type ShareResult, shareStatusLabel } from '@kbs/shared';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { Button, Callout, ErrorText, Icon, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

const ICON: Record<ShareBody['kind'], IconName> = {
  APPLICATION_LINK: 'link',
  BENEFIT_PDF: 'document-attach-outline',
  OFFICE_ID: 'id-card-outline',
};

/**
 * F-311: three separate share actions. Each tap → POST /share (logged) → open the WhatsApp compose sheet.
 * The status line is derived from the server's deliveryStatus/handoffResult only (WA-01): hand-off never says "Delivered".
 */
export function ShareButtons({
  target,
  cardId,
  kinds,
  onShared,
}: {
  target: { type: ShareBody['targetType']; id: string };
  cardId?: string;
  kinds: ShareBody['kind'][];
  onShared?: (r: ShareResult) => void;
}) {
  const [busy, setBusy] = useState<ShareBody['kind'] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const LABEL: Record<ShareBody['kind'], string> = {
    BENEFIT_PDF: 'Share benefit PDF',
    OFFICE_ID: 'Share my official ID',
    APPLICATION_LINK: 'Share application link',
  };
  const send = async (kind: ShareBody['kind']) => {
    setBusy(kind);
    setError(null);
    setStatus(null);
    try {
      const r = await api.post<ShareResult>('/share', {
        targetType: target.type,
        targetId: target.id,
        kind,
        cardId: kind === 'OFFICE_ID' ? undefined : cardId,
      });
      if (!r.data.consentPolicyConfigured)
        setWarn(
          'WhatsApp consent policy is not configured yet — share only when the customer has agreed on the call.',
        );
      if (r.data.handoffUrl) {
        try {
          await Linking.openURL(r.data.handoffUrl);
        } catch {
          setError('WhatsApp could not be opened on this phone.');
        }
      }
      setStatus(`${LABEL[kind].replace('Share ', '')}: ${shareStatusLabel(r.data)}`);
      onShared?.(r.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not share.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <View className="gap-2.5">
      {kinds.map((k) => (
        <Button
          key={k}
          title={busy === k ? 'Opening WhatsApp…' : LABEL[k]}
          icon={ICON[k]}
          loading={busy === k}
          variant={k === 'APPLICATION_LINK' ? 'default' : 'outline'}
          disabled={busy !== null || (k !== 'OFFICE_ID' && !cardId)}
          onPress={() => void send(k)}
        />
      ))}
      {status ? (
        <View
          accessibilityLiveRegion="polite"
          className="flex-row items-center gap-2 rounded-xl bg-[#F4F6FB] px-3 py-2.5"
        >
          <Icon name="information-circle-outline" size={16} color={colors.muted} />
          <RNText className="flex-1 font-medium text-[13px] text-[#374151]">{status}</RNText>
        </View>
      ) : null}
      {warn ? <Callout kind="warning">{warn}</Callout> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
