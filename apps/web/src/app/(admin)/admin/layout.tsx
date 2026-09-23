import { AdminShell } from '@/components/admin-shell';
import { requireRole } from '@/lib/require-role';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ADMIN');
  return <AdminShell session={session}>{children}</AdminShell>;
}
