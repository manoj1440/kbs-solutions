import { LeadsBrowser, type LeadsSearch } from '@/components/leads-browser';

/** F-408 (Manager): the team's leads, same table as Admin, scoped server-side. */
export default async function ManagerLeadsPage({ searchParams }: { searchParams: Promise<LeadsSearch> }) {
  return <LeadsBrowser basePath="/manager/leads" sp={await searchParams} title="Team leads" description="Leads created by advisors reporting to you, with bank status from applied MIS batches only." />;
}
