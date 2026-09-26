import { formatDateTime } from '@kbs/shared';
import { Ban, PhoneOff, ShieldCheck, Undo2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  EmptyState,
  humanize,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
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

/** F-306 / F-304 Admin: suppression list, DND import, pincode master import. */
export default async function CompliancePage() {
  const s = await apiFetch<Suppression[]>('/suppressions?pageSize=100&includeLifted=true');
  const total = Number(s.meta.total ?? s.data.length);
  const active = s.data.filter((r) => !r.liftedAt).length;
  const lifted = s.data.length - active;
  const scope =
    total > s.data.length ? `Of the latest ${s.data.length} entries` : 'Across all entries';
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Administration"
        title="Compliance & reference data"
        tone="rose"
        description="Do-not-contact suppression applies to every import and blocks call initiation server-side. Records are hidden, never deleted (INV-07)."
      >
        <StatGrid className="xl:grid-cols-3">
          <StatCard
            label="Suppression entries"
            value={total}
            hint="Including lifted"
            icon={ShieldCheck}
            tone="slate"
          />
          <StatCard
            label="Active suppressions"
            value={active}
            hint={`${scope} · calls blocked`}
            icon={Ban}
            tone={active ? 'rose' : 'slate'}
          />
          <StatCard
            label="Lifted"
            value={lifted}
            hint={`${scope} · kept for the record`}
            icon={Undo2}
            tone="sky"
            className="col-span-2 xl:col-span-1"
          />
        </StatGrid>
      </PageHeader>
      <ComplianceActions />
      <SectionCard
        icon={PhoneOff}
        tone="rose"
        title="Suppressed mobiles"
        description={`${String(s.meta.total ?? s.data.length)} entries (including lifted).`}
        flush={s.data.length > 0}
      >
        {s.data.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No suppressed mobiles"
            description="Suppress a mobile above or import a DND list. Suppressed numbers are never called."
          />
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Mobile</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell data-label="Mobile" className="font-mono text-xs text-slate-800">
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
                  <TableCell className="sm:text-right">
                    {r.liftedAt ? null : <LiftButton id={r.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
