import { misStatusField } from '@kbs/shared';
import { Redirect } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { CreditCardArt } from '@/components/brand/credit-card-art';
import {
  ActivationBadge,
  DecisionBadge,
  PayoutStateBadge,
  ProvenanceChip,
  StageBadge,
  StatusTrio,
} from '@/components/status';
import { DistributionCard, HeroTile, MetricTile, TimelineItem } from '@/components/team';
import {
  AppBar,
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  Chip,
  ChoiceRow,
  Display,
  EmptyState,
  ErrorState,
  ErrorText,
  Heading,
  HeroHeader,
  IconButton,
  IconCircle,
  Input,
  KeyValue,
  ListItem,
  Muted,
  Overline,
  ProgressBar,
  Screen,
  SectionHeader,
  Segmented,
  SkeletonList,
  StatTile,
  Stepper,
  Text,
} from '@/components/ui';

const AS_OF = '2026-09-20T10:30:00.000Z';
const SAMPLES = [
  { label: 'Never matched', field: misStatusField(null, false, null, null) },
  { label: 'Matched, blank cell', field: misStatusField('#N/A', true, AS_OF, 'KBS-M-DEMO1') },
  { label: 'Reported Inprocess', field: misStatusField('Inprocess', true, AS_OF, 'KBS-M-DEMO1') },
  {
    label: 'Reported Approve / Active',
    field: misStatusField('APPROVE', true, AS_OF, 'KBS-M-DEMO1'),
  },
  { label: 'Reported Decline', field: misStatusField('Decline', true, AS_OF, 'KBS-M-DEMO1') },
];
const PAYOUTS = [
  'PENDING_HOLD',
  'ELIGIBLE_AVAILABLE',
  'RESERVED',
  'UNDER_REVIEW',
  'VOID',
  'PENDING_APPROVALS',
  'APPROVED',
  'PAID',
  'REJECTED',
];
const TONES = [
  'default',
  'secondary',
  'success',
  'warning',
  'destructive',
  'info',
  'unknown',
] as const;
const DIST = {
  source: 'BANK_MIS' as const,
  dateBasis: 'Lead created',
  denominator: { label: 'leads', value: 7 },
  buckets: [
    { value: 'Decisioned Cases', count: 3 },
    { value: 'VKYC Pending', count: 2 },
    { value: 'Awaiting MIS', count: 2 },
  ],
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

function Gallery() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [chip, setChip] = useState('all');
  const [choice, setChoice] = useState(0);
  const [text, setText] = useState('');
  return (
    <Screen
      scroll
      header={<AppBar title="Design system" subtitle="F-805 component gallery (dev only)" />}
    >
      <Section title="Typography">
        <Card className="gap-1">
          <Overline>Overline</Overline>
          <Display>₹1,24,500</Display>
          <Heading>Heading</Heading>
          <Text>Body text — the default reading size.</Text>
          <Muted>Muted meta text for secondary information.</Muted>
          <ErrorText>Inline form error</ErrorText>
        </Card>
      </Section>

      <Section title="Buttons">
        <Button title="Primary" icon="arrow-forward" />
        <Button title="Gold" variant="gold" icon="wallet" />
        <View className="flex-row gap-2">
          <Button title="Secondary" variant="secondary" className="flex-1" />
          <Button title="Outline" variant="outline" className="flex-1" />
        </View>
        <View className="flex-row gap-2">
          <Button title="Destructive" variant="destructive" className="flex-1" />
          <Button title="Loading" loading className="flex-1" />
        </View>
        <View className="flex-row items-center gap-2">
          <Button title="Small" size="sm" />
          <Button title="Ghost" variant="ghost" size="sm" />
          <IconButton icon="notifications-outline" label="Notifications" badge={3} />
          <IconButton icon="add" label="Add" tone="soft" />
        </View>
      </Section>

      <Section title="Badges, chips, segmented">
        <View className="flex-row flex-wrap gap-2">
          {TONES.map((t) => (
            <Badge key={t} label={t} variant={t} dot />
          ))}
          <Badge label="Solid" variant="destructive" solid icon="alarm" />
        </View>
        <View className="flex-row flex-wrap gap-2">
          {['all', 'cashback', 'travel'].map((c) => (
            <Chip
              key={c}
              label={c}
              active={chip === c}
              onPress={() => setChip(c)}
              count={c === 'all' ? 12 : undefined}
            />
          ))}
        </View>
        <Segmented
          options={[
            { key: 'a', label: 'Queue', count: 4 },
            { key: 'b', label: 'Follow-ups', count: 1 },
            { key: 'c', label: 'History' },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </Section>

      <Section title="Avatars, icons, progress">
        <View className="flex-row items-center gap-3">
          <Avatar name="Asha Advisor" />
          <Avatar name="Demo Telecaller" size={36} />
          <IconCircle icon="wallet" tone="gold" />
          <IconCircle icon="checkmark" tone="success" solid />
          <IconCircle icon="alert" tone="destructive" />
        </View>
        <ProgressBar value={0.66} />
        <ProgressBar value={0.4} tone="gold" />
        <Stepper steps={['Customer', 'Card', 'Review']} current={1} />
      </Section>

      <Section title="Inputs">
        <Input
          label="Search"
          icon="search"
          placeholder="Name, pincode or city"
          value={text}
          onChangeText={setText}
          hint="Hint text below the field"
        />
        <Input
          label="With error"
          prefix="+91"
          value="12345"
          error="Enter a 10-digit mobile number"
        />
        {['Connected — interested', 'Callback / follow-up'].map((l, i) => (
          <ChoiceRow key={l} label={l} selected={choice === i} onPress={() => setChoice(i)} />
        ))}
      </Section>

      <Section title="Cards & lists">
        <Card className="px-4 py-1">
          <ListItem
            icon="person-outline"
            title="List item"
            subtitle="With subtitle and chevron"
            onPress={() => undefined}
          />
          <ListItem
            icon="log-out-outline"
            title="Destructive row"
            destructive
            onPress={() => undefined}
            chevron={false}
            last
          />
        </Card>
        <Card className="py-1">
          <KeyValue label="Employee code" value="KBS-TC-EXMZBSY3" />
          <KeyValue label="Mobile" value="+91••••••0001" last />
        </Card>
        <View className="flex-row gap-3">
          <StatTile label="Stat tile" value="42" icon="people" />
          <StatTile label="Gold tone" value="₹3,000" icon="wallet" tone="gold" hint="hint" />
        </View>
        <View className="flex-row gap-3">
          <MetricTile
            className="flex-1"
            label="MIS matched"
            m={{ value: 6, denominator: { label: 'leads', value: 7 }, source: 'BANK_MIS' }}
            icon="git-compare"
            tone="info"
          />
          <MetricTile
            className="flex-1"
            label="Approved, unpaid"
            m={{ value: 1, amountInr: 1500, source: 'KBS_PAYOUT_LEDGER' }}
            money
            icon="hourglass"
            tone="gold"
          />
        </View>
        <DistributionCard title="Current stage" icon="layers-outline" d={DIST} />
        <Card>
          <TimelineItem
            icon="create-outline"
            tone="info"
            title="Timeline item"
            meta="23 Sept 2026 · Demo Telecaller"
          />
          <TimelineItem icon="call-outline" title="Last item" meta="No connector below" last />
        </Card>
      </Section>

      <Section title="Hero">
        <View className="overflow-hidden rounded-3xl">
          <HeroHeader rounded={false} style={{ paddingTop: 16 }}>
            <View className="flex-row gap-2">
              <HeroTile label="Active" value={4} meta="in your queue" />
              <HeroTile label="Due" value={1} meta="call back now" icon="alarm" />
            </View>
          </HeroHeader>
        </View>
        <View className="items-center">
          <CreditCardArt bank="HDFC Bank" name="Millennia" width={300} />
        </View>
      </Section>

      <Section title="Callouts & states">
        <Callout kind="info" title="Info">
          Informational message.
        </Callout>
        <Callout kind="warning">Indicative only — the bank decides every application.</Callout>
        <Callout kind="danger">This customer asked not to be contacted.</Callout>
        <Callout kind="success">Outcome saved.</Callout>
        <EmptyState
          icon="call-outline"
          title="Empty state"
          body="One line of guidance with a next step."
          action="Do something"
          onAction={() => undefined}
        />
        <ErrorState message="Could not load. Check your connection." onRetry={() => undefined} />
        <SkeletonList rows={2} />
      </Section>

      <Section title="Bank status (text always shown, REQ-20 §20.2)">
        {SAMPLES.map((s) => (
          <Card key={s.label} className="gap-2">
            <Text className="font-semibold">{s.label}</Text>
            <StageBadge field={s.field} />
            <DecisionBadge field={s.field} />
            <ActivationBadge field={s.field} />
          </Card>
        ))}
        <StatusTrio
          stage={SAMPLES[2]!.field}
          decision={SAMPLES[3]!.field}
          activation={SAMPLES[0]!.field}
        />
        <Card className="gap-2">
          <Text className="font-semibold">Provenance</Text>
          <ProvenanceChip provenance="BANK_MIS" asOf={AS_OF} />
          <ProvenanceChip provenance="KBS_OPERATIONAL" asOf={AS_OF} />
          <ProvenanceChip provenance="KBS_PAYMENT" asOf={AS_OF} />
        </Card>
        <Card className="gap-2">
          <Text className="font-semibold">Payout states</Text>
          <View className="flex-row flex-wrap gap-2">
            {PAYOUTS.map((p) => (
              <PayoutStateBadge key={p} state={p} />
            ))}
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

/** F-803 / F-805 visual QA screen (dev builds only): every design-system component and status / provenance variant with fixture data. */
export default function DevComponents() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}
