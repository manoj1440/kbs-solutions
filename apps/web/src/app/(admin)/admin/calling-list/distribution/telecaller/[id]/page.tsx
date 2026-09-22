import { TelecallerActivity } from '@/components/team-ops';

export default async function AdminTelecallerActivityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <TelecallerActivity id={id} base="/admin/calling-list/distribution" sp={sp} />;
}
