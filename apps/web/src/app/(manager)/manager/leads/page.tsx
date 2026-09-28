import { LeadsBrowser, type LeadsSearch } from '@/components/leads-browser';

export const metadata = { title: 'Team leads · KBS Solutions' };

/** F-408/F-810 (Manager): the team's leads, same browser as Admin, scoped server-side. */
export default async function ManagerLeadsPage({ searchParams }: { searchParams: Promise<LeadsSearch> }) {
  return <LeadsBrowser basePath="/manager/leads" sp={await searchParams} title="Team leads" />;
}
