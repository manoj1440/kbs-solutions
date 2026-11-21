import { TelecallerActivity } from '@/components/team-ops';

export const metadata = { title: 'Telecaller activity' };

export default async function AdminTelecallerActivityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <TelecallerActivity id={id} base="/admin/calling-list/performance" sp={sp} />;
}
