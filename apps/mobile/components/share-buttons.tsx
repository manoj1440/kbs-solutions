import { ApiClientError, type ShareBody, type ShareResult, shareStatusLabel } from '@kbs/shared';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, ErrorText, Muted } from '@/components/ui';
import { api } from '@/lib/api';

/**
 * F-311: three separate share actions. Each tap → POST /share (logged) → open the WhatsApp compose sheet.
 * The status line is derived from the server's deliveryStatus/handoffResult only (WA-01): hand-off never says "Delivered".
 */
export function ShareButtons({ target, cardId, kinds, onShared }: { target: { type: ShareBody['targetType']; id: string }; cardId?: string; kinds: ShareBody['kind'][]; onShared?: (r: ShareResult) => void }) {
  const [busy, setBusy] = useState<ShareBody['kind'] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const LABEL: Record<ShareBody['kind'], string> = { BENEFIT_PDF: 'Share benefit PDF', OFFICE_ID: 'Share my official ID', APPLICATION_LINK: 'Share application link' };
  const send = async (kind: ShareBody['kind']) => {
    setBusy(kind);
    setError(null);
    setStatus(null);
    try {
      const r = await api.post<ShareResult>('/share', { targetType: target.type, targetId: target.id, kind, cardId: kind === 'OFFICE_ID' ? undefined : cardId });
      if (!r.data.consentPolicyConfigured) setWarn('WhatsApp consent policy is not configured yet — share only when the customer has agreed on the call.');
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
    <View className="gap-2">
      {kinds.map((k) => (
        <Button key={k} title={busy === k ? 'Opening WhatsApp…' : LABEL[k]} variant={k === 'APPLICATION_LINK' ? 'default' : 'outline'} disabled={busy !== null || (k !== 'OFFICE_ID' && !cardId)} onPress={() => void send(k)} />
      ))}
      {status ? <Muted>{status}</Muted> : null}
      {warn ? <Muted>{warn}</Muted> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
