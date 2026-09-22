import { LeadDetail } from '@/components/lead-detail';

export default async function ManagerLeadPage({ params }: { params: Promise<{ id: string }> }) {
  return <LeadDetail id={(await params).id} backHref="/manager/leads" />;
}
