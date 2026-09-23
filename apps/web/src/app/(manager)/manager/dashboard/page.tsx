import { OperationsDashboard } from '@/components/operations-dashboard';

/** F-702 Manager dashboard (REQ-15 §15.2). */
export default async function ManagerDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <OperationsDashboard basePath="/manager/dashboard" endpoint="/dashboards/manager" sp={await searchParams} title="Team dashboard" />;
}
