import { AdvisorPerformance } from '@/components/admin-dashboard-tables';

export const metadata = { title: 'Advisor performance' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <AdvisorPerformance sp={await searchParams} />;
}
