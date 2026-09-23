import { ManagerPerformance } from '@/components/admin-dashboard-tables';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ManagerPerformance sp={await searchParams} />;
}
