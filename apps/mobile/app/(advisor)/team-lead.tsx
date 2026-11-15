import { useLocalSearchParams } from 'expo-router';

import { ReadOnlyLeadView } from '@/components/lead-readonly';

/** F-824: a lead of an Advisor who signed up with this Advisor's code — read-only, no amounts. */
export default function TeamLeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReadOnlyLeadView key={id} id={id} />;
}
