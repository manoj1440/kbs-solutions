import { LeadDetail } from '@/components/lead-detail';

export default async function AdminLeadPage({ params }: { params: Promise<{ id: string }> }) {
  return <LeadDetail id={(await params).id} backHref="/admin/leads" />;
}
