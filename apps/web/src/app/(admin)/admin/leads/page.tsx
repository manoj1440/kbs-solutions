import { LeadsBrowser, type LeadsSearch } from '@/components/leads-browser';

/** F-408 (Admin): all leads with the REQ-14 §14.2 status table. */
export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<LeadsSearch> }) {
  return <LeadsBrowser basePath="/admin/leads" sp={await searchParams} title="Leads" description="Every lead with its latest bank-reported status. Status comes only from applied MIS batches." />;
}
