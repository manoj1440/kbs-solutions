import { AdminDashboardNav } from '@/components/admin-dashboard-nav';
import { OperationsDashboard } from '@/components/operations-dashboard';

/** F-703 executive overview: same engine as the Manager dashboard; alerts are never hidden (REQ-20 §20.4). */
export default async function ExecutiveDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <div className="grid gap-4">
      <AdminDashboardNav active="/admin/dashboards" />
      <OperationsDashboard basePath="/admin/dashboards" endpoint="/dashboards/admin/executive" sp={await searchParams} title="Executive dashboard" />
    </div>
  );
}
