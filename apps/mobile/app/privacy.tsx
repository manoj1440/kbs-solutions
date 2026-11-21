import { COMPANY, formatDate, legalFact, PRIVACY_NOTICE } from '@kbs/shared';
import { router } from 'expo-router';
import { Text as RNText, View } from 'react-native';

import { AppBar, Appear, Card, Callout, KeyValue, Screen } from '@/components/ui';

/** Back to where the reader came from; a cold deep link has no history, so it goes to the app entry instead. */
function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * F-908: the privacy notice, the same text as the web `/privacy` page (`PRIVACY_NOTICE` in @kbs/shared). Root level so it
 * opens signed in or signed out — from the sign-in screen, onboarding consent and every profile.
 */
export default function PrivacyNotice() {
  const n = PRIVACY_NOTICE;
  const g = COMPANY.grievanceOfficer;
  return (
    <Screen scroll header={<AppBar title="Privacy notice" subtitle={`Version ${n.version}, updated ${formatDate(n.updated)}`} onBack={back} />}>
      <View className="gap-4 pb-8">
        {n.sections.length === 0 ? (
          <Callout kind="info" title="The full notice is being finalised">
            KBS Solutions uses your details only to run your account, verify your identity, track
            applications and pay you. Contact the Grievance Officer below with any question.
          </Callout>
        ) : (
          n.sections.map((s, i) => (
            <Appear key={s.id} index={i}>
              <Card className="gap-2 p-4">
                <RNText accessibilityRole="header" className="font-medium text-lg text-ink">
                  {s.heading}
                </RNText>
                {s.paragraphs.map((p, j) => (
                  <RNText key={j} selectable className="font-normal text-md leading-6 text-[#3F3A34]">
                    {p}
                  </RNText>
                ))}
                {s.items?.length ? (
                  <View className="gap-1.5 pt-1">
                    {s.items.map((it, j) => (
                      <View key={j} className="flex-row gap-2.5">
                        <View className="mt-2.5 h-1 w-1 rounded-full bg-ink" />
                        <RNText selectable className="flex-1 font-normal text-md leading-6 text-[#3F3A34]">
                          {it}
                        </RNText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            </Appear>
          ))
        )}

        <Card className="px-4 py-2">
          <RNText accessibilityRole="header" className="pb-1 pt-2 font-medium text-lg text-ink">
            Grievance Officer
          </RNText>
          <KeyValue label="Name" value={legalFact(g.name)} />
          <KeyValue label="Designation" value={legalFact(g.designation)} />
          <KeyValue label="Email" value={legalFact(g.email)} />
          <KeyValue label="Phone" value={legalFact(g.phone)} />
          <KeyValue label="Hours" value={legalFact(g.hours)} last />
        </Card>
        <RNText className="px-1 font-normal text-sm text-[#525252]">
          Signed in, you can download your data, ask for a correction or deletion, or raise a
          grievance from Your data on your Profile.
        </RNText>
      </View>
    </Screen>
  );
}
