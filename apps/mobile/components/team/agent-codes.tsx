import { ApiClientError } from '@kbs/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { Button, Card, Icon, SectionHeader, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

interface AgentCodeRow {
  id: string;
  code: string;
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: string | null;
  activeAdvisors: number;
}

/**
 * REQ-10 §10.4: the Manager's own Agent Code(s), read-only — Advisors enter one to report to this Manager.
 * `GET /agent-codes` returns only the caller's codes for a Manager; revoked and expired codes are not shown
 * because they can no longer be used. Creating / revoking stays with the Admin on web.
 */
export function MyAgentCodes() {
  const [codes, setCodes] = useState<AgentCodeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = (await api.get<AgentCodeRow[]>('/agent-codes')).data;
      const now = Date.now();
      setCodes(
        rows.filter(
          (c) => c.status === 'ACTIVE' && (!c.expiresAt || new Date(c.expiresAt).getTime() > now),
        ),
      );
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your Agent Codes.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View className="gap-3">
      <SectionHeader title="My Agent Codes" />
      <Card className="gap-3 p-4">
        {error && !codes ? (
          <View accessibilityRole="alert" className="gap-3">
            <RNText className="font-normal text-sm text-[#B42318]">{error}</RNText>
            <Button
              title="Try again"
              size="sm"
              variant="secondary"
              icon="refresh"
              className="self-start"
              onPress={() => void load()}
            />
          </View>
        ) : !codes ? (
          <View accessibilityLabel="Loading" className="gap-2">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-3 w-full" />
          </View>
        ) : codes.length === 0 ? (
          <RNText className="font-normal text-sm text-[#525252]">
            No Agent Code yet. Ask the Admin to create one for you.
          </RNText>
        ) : (
          <>
            <View className="gap-2">
              {codes.map((c) => (
                <View
                  key={c.id}
                  accessibilityLabel={`Agent Code ${c.code.split('').join(' ')}, ${c.activeAdvisors} advisor${c.activeAdvisors === 1 ? '' : 's'}`}
                  className="flex-row items-center justify-between gap-3"
                >
                  <View className="flex-row items-center gap-2 rounded-lg bg-raised px-3 py-2">
                    <Icon name="key-outline" size={16} color={colors.subtle} />
                    <RNText
                      selectable
                      className="text-lg text-ink"
                      style={{ fontFamily: 'monospace', letterSpacing: 1.5 }}
                    >
                      {c.code}
                    </RNText>
                  </View>
                  <RNText className="font-normal text-sm text-[#525252] tabular-nums">
                    {c.activeAdvisors} advisor{c.activeAdvisors === 1 ? '' : 's'}
                  </RNText>
                </View>
              ))}
            </View>
            <RNText className="font-normal text-sm text-[#525252]">
              Share this code with Advisors — they enter it during signup or in Profile to report to
              you.
            </RNText>
          </>
        )}
      </Card>
    </View>
  );
}
