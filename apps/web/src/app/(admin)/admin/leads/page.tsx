import { LeadsBrowser, type LeadsSearch } from '@/components/leads-browser';

export const metadata = { title: 'Leads · KBS Solutions' };

/** F-408/F-810 (Admin): all leads with cumulative status tiles + the REQ-14 §14.2 status table. */
export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<LeadsSearch> }) {
  return <LeadsBrowser basePath="/admin/leads" sp={await searchParams} title="Leads" />;
}
