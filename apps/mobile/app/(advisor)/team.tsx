import { ApiClientError, formatDateTime } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, Text as RNText, View } from 'react-native';

import {
  AppBar,
  Appear,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  Icon,
  ListItem,
  Muted,
  Screen,
  SectionHeader,
  SkeletonList,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

interface Team {
  code: { code: string; status: string } | null;
  advisors: {
    id: string;
    fullName: string;
    publicRef: string;
    status: string;
    mobileMasked: string | null;
    since: string;
    leads: number;
  }[];
}

/**
 * F-824: an Advisor's own Agent Code and the Advisors who signed up with it. Their leads are readable in full;
 * any share on them is settled with KBS outside the app — nothing here is an amount.
 */
export default function MyTeamScreen() {
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setTeam((await api.get<Team>('/me/team')).data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your team.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const getCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/me/agent-codes', {});
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not create your code.');
    } finally {
      setBusy(false);
    }
  };
  const code = team?.code?.code ?? null;
  return (
    <Screen scroll header={<AppBar title="My team" />}>
      {error && !team ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!team && !error ? <SkeletonList rows={3} /> : null}
      {team ? (
        <>
          <Appear>
            <Card className="gap-3">
              <RNText accessibilityRole="header" className="font-medium text-base text-ink">
                My Agent Code
              </RNText>
              {code ? (
                <>
                  <View className="flex-row items-center justify-between rounded-lg bg-raised px-4 py-3">
                    <RNText
                      accessibilityLabel={`My Agent Code ${code}`}
                      selectable
                      className="font-semibold text-xl tracking-widest text-ink"
                    >
                      {code}
                    </RNText>
                    <Icon name="key-outline" size={20} color={colors.subtle} />
                  </View>
                  <Muted className="text-xs">
                    An Advisor who enters this code when signing up reports to you. You can then see
                    their leads here.
                  </Muted>
                  <Button
                    title="Share my code"
                    icon="share-social-outline"
                    variant="outline"
                    onPress={() =>
                      void Share.share({
                        message: `Join KBS Solutions as an Advisor. Enter my Agent Code ${code} when you sign up.`,
                      })
                    }
                  />
                </>
              ) : (
                <>
                  <Muted className="text-sm">
                    Get a code to give to other Advisors. Those who sign up with it report to you.
                  </Muted>
                  <Button
                    title={busy ? 'Creating…' : 'Get my code'}
                    icon="key-outline"
                    loading={busy}
                    disabled={busy}
                    onPress={() => void getCode()}
                  />
                </>
              )}
              <ErrorText>{error}</ErrorText>
            </Card>
          </Appear>

          <Appear index={1} className="gap-3">
            <SectionHeader title={`Advisors with my code · ${team.advisors.length}`} />
            {team.advisors.length === 0 ? (
              <EmptyState
                compact
                icon="people-outline"
                title="Nobody has used your code yet"
                body="Advisors appear here after KBS approves their onboarding."
              />
            ) : (
              <Card className="px-4 py-1">
                {team.advisors.map((a, i) => (
                  <ListItem
                    key={a.id}
                    leading={<Avatar name={a.fullName} size={40} />}
                    title={a.fullName}
                    subtitle={`${a.leads} lead${a.leads === 1 ? '' : 's'} · since ${formatDateTime(a.since)}`}
                    right={
                      a.status === 'ACTIVE' ? undefined : (
                        <Badge
                          label={a.status.toLowerCase().replace(/_/g, ' ')}
                          variant="warning"
                        />
                      )
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/(advisor)/team-advisor',
                        params: { id: a.id, name: a.fullName },
                      } as never)
                    }
                    last={i === team.advisors.length - 1}
                  />
                ))}
              </Card>
            )}
            <Muted className="px-1 text-xs">
              Any share on their leads is settled with KBS directly. The app shows the leads, not an
              amount.
            </Muted>
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}
