import { ManagerPerformance } from '@/components/admin-dashboard-tables';

export const metadata = { title: 'Manager performance' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ManagerPerformance sp={await searchParams} />;
}
