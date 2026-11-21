import { TelecallerPerformance } from '@/components/admin-dashboard-tables';

export const metadata = { title: 'Telecaller performance' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <TelecallerPerformance sp={await searchParams} />;
}
