import { type CallingQueueRow, formatDateTime } from '@kbs/shared';

import { ReassignForm } from '@/components/reassign-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

export interface DistributionRow {
  id: string;
  fullName: string;
  employeeCode: string | null;
  status: string;
  trained: boolean;
  eligible: boolean;
  active: number;
  byStatus: Record<string, number>;
  needsReassignment: boolean;
}
interface Distribution {
  telecallers: DistributionRow[];
  unassigned: number | null;
}

/** F-305 §6 / F-307 §4: distribution + scoped records with reassignment (Manager: team; Admin: all). */
export async function CallingDistribution({
  scope,
  telecallerId,
  tab = 'active',
}: {
  scope: 'manager' | 'admin';
  telecallerId?: string;
  tab?: 'active' | 'followups' | 'hidden';
}) {
  const [dist, records] = await Promise.all([
    apiFetch<Distribution>('/calling/distribution'),
    apiFetch<CallingQueueRow[]>(
      `/calling/records?tab=${tab}&pageSize=100${telecallerId ? `&telecallerId=${telecallerId}` : ''}`,
    ),
  ]);
  const base = scope === 'manager' ? '/manager/calling' : '/admin/calling-list/distribution';
  const eligible = dist.data.telecallers.filter((t) => t.eligible);
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Distribution</CardTitle>
          <CardDescription>
            Active records per Telecaller
            {dist.data.unassigned !== null
              ? ` · ${dist.data.unassigned} accepted records unassigned (no eligible Telecaller or consent gate)`
              : ''}
            . Deactivated Telecallers still holding records are flagged — reassign them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Telecaller</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Eligible</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Breakdown</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dist.data.telecallers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell data-label="Telecaller">
                    <div className="font-medium">{t.fullName}</div>
                    {t.employeeCode ? (
                      <div className="text-muted-foreground mt-1 text-xs">{t.employeeCode}</div>
                    ) : null}
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge variant={t.status === 'ACTIVE' ? 'success' : 'unknown'}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Eligibility">
                    {t.eligible ? (
                      <Badge variant="success">trained</Badge>
                    ) : (
                      <Badge variant="warning">{t.trained ? 'inactive' : 'training pending'}</Badge>
                    )}
                  </TableCell>
                  <TableCell data-label="Active records">
                    {t.active}{' '}
                    {t.needsReassignment ? (
                      <Badge variant="destructive">needs reassignment</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell data-label="Breakdown" className="text-xs">
                    {Object.entries(t.byStatus)
                      .map(([k, n]) => `${k.toLowerCase().replace('_', ' ')} ${n}`)
                      .join(' · ') || '—'}
                  </TableCell>
                  <TableCell data-label="Actions">
                    <a className="text-xs underline" href={`${base}?telecallerId=${t.id}`}>
                      view records
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Records{telecallerId ? ' — selected Telecaller' : ''}</CardTitle>
          <CardDescription>
            {(['active', 'followups', 'hidden'] as const).map((t) => (
              <a
                key={t}
                className={`mr-3 underline ${t === tab ? 'font-semibold' : ''}`}
                href={`${base}?tab=${t}${telecallerId ? `&telecallerId=${telecallerId}` : ''}`}
              >
                {t}
              </a>
            ))}
            · {String(records.meta.total ?? records.data.length)} rows · mobiles masked (REQ-08
            §8.3)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Customer / mobile</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Follow-up / last outcome</TableHead>
                <TableHead>Reassign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center">
                    No records.
                  </TableCell>
                </TableRow>
              ) : null}
              {records.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell data-label="Customer / mobile">
                    <div className="font-medium">{r.fullName}</div>
                    <div className="text-muted-foreground mt-1 font-mono text-xs">
                      {r.mobileMasked}
                    </div>
                  </TableCell>
                  <TableCell data-label="Location" className="text-xs">
                    <div>{r.pincode}</div>
                    <div className="text-muted-foreground mt-1">{r.location}</div>
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge variant="secondary">{r.interactionStatus}</Badge>
                    {r.suppressed ? <Badge variant="destructive">DNC</Badge> : null}
                  </TableCell>
                  <TableCell data-label="Assigned to" className="text-xs">
                    {r.assignedTelecaller?.fullName ?? <em>unassigned</em>}
                  </TableCell>
                  <TableCell data-label="Follow-up / last outcome" className="text-xs">
                    <div>
                      {r.nextFollowUpAt
                        ? `Due ${formatDateTime(r.nextFollowUpAt)}`
                        : 'No follow-up scheduled'}
                    </div>
                    <div className="text-muted-foreground mt-1">
                      {r.lastOutcome
                        ? `${r.lastOutcome.outcome}${r.lastOutcome.remarks ? ` — ${r.lastOutcome.remarks}` : ''}`
                        : 'No outcome recorded'}
                    </div>
                  </TableCell>
                  <TableCell data-label="Reassign">
                    {r.hiddenAt ? null : (
                      <ReassignForm
                        recordId={r.id}
                        currentId={r.assignedTelecaller?.id ?? null}
                        options={eligible.map((t) => ({ id: t.id, label: t.fullName }))}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
