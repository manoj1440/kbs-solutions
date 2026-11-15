import { useLocalSearchParams } from 'expo-router';

import { ReadOnlyLeadView } from '@/components/lead-readonly';

/** F-315 (Manager mobile): read-only lead view — the Manager checks the Advisor's lead and its real MIS values. */
export default function ManagerLeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // hidden tab, stays mounted: keyed by id so nothing from the previous record is shown or submitted
  return <ReadOnlyLeadView key={id} id={id} />;
}
