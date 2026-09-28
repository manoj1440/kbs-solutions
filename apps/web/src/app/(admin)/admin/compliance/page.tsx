import { formatDateTime } from '@kbs/shared';
import { ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  EmptyState,
  humanize,
  MiniStat,
} from '@/components/ui/kit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

import { ComplianceActions, LiftButton } from './actions';

export const metadata = { title: 'Compliance · KBS Solutions' };

interface Suppression {
  id: string;
  mobile: string;
  reason: string;
  at: string;
  liftedAt: string | null;
  createdByUserId: string | null;
}

const REASON: Record<string, string> = {
  CUSTOMER_REQUEST: 'Customer request',
  COMPLIANCE: 'Compliance',
  DND_LIST: 'DND list',
};

/** F-306/F-304 → F-811 Admin: suppression list, DND import, pincode master import. */
export default async function CompliancePage() {
  const s = await apiFetch<Suppression[]>('/suppressions?pageSize=100&includeLifted=true');
  const total = Number(s.meta.total ?? s.data.length);
  const active = s.data.filter((r) => !r.liftedAt).length;
  const lifted = s.data.length - active;
  const scope = total > s.data.length ? `of the latest ${s.data.length}` : 'all entries';
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Compliance &amp; reference data</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3">
        <MiniStat label="Suppression entries" value={total} hint="Including lifted" tone="sky" />
        <MiniStat label="Active suppressions" value={active} hint={`${scope} · calls blocked`} tone={active ? 'rose' : 'slate'} />
        <MiniStat label="Lifted" value={lifted} hint={`${scope} · kept for the record`} tone="violet" />
      </div>
      <ComplianceActions />
      <section aria-label="Suppressed mobiles" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          Suppression applies to every import and blocks call initiation server-side — hidden, never deleted (INV-07).
        </div>
        <div className="min-h-0 flex-1">
          {s.data.length === 0 ? (
            <EmptyState icon={ShieldCheck} className="m-3" title="No suppressed mobiles" description="Suppress a mobile above or import a DND list. Suppressed numbers are never called." />
          ) : (
            <Table responsive containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="pl-4">Mobile</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4 font-mono text-xs text-slate-800" data-label="Mobile">
                      {r.mobile}
                    </TableCell>
                    <TableCell data-label="Reason">
                      <Badge variant="secondary">{REASON[r.reason] ?? humanize(r.reason)}</Badge>
                    </TableCell>
                    <TableCell data-label="Added" className="text-xs text-slate-600">
                      {formatDateTime(r.at)}
                    </TableCell>
                    <TableCell data-label="Status">
                      {r.liftedAt ? (
                        <Badge variant="unknown">lifted {formatDateTime(r.liftedAt)}</Badge>
                      ) : (
                        <Badge variant="destructive">active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 sm:text-right">
                      {r.liftedAt ? null : <LiftButton id={r.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex shrink-0 items-center border-t border-slate-100 px-4 py-2 text-xs text-slate-500 tabular-nums">
          {total} entr{total === 1 ? 'y' : 'ies'}
        </div>
      </section>
    </div>
  );
}
