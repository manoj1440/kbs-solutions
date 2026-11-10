import { ShieldAlert } from 'lucide-react';

import { Callout, MiniStat, StatStrip } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { CreateAgentCodeForm, type OwnerOption } from './agent-code-forms';
import {
  type AgentCode,
  type AgentCodeRow,
  AgentCodesTable,
  type PendingChange,
  PendingChangesTable,
} from './agent-codes-tables';

export const metadata = { title: 'Agent codes · KBS Solutions' };

/** A code past its expiry is still ACTIVE in the database but can no longer be applied. */
function withState(codes: AgentCode[]): AgentCodeRow[] {
  const now = Date.now();
  return codes.map((c) => ({
    ...c,
    state:
      c.status === 'REVOKED'
        ? 'REVOKED'
        : c.expiresAt && new Date(c.expiresAt).getTime() <= now
          ? 'EXPIRED'
          : 'ACTIVE',
  }));
}

/** F-106 Admin: Agent Codes and pending reporting changes (REQ-10 §10.4, gap-analysis B7). */
export default async function AgentCodesPage() {
  const [codes, pending, managers, admins] = await Promise.all([
    apiFetch<AgentCode[]>('/agent-codes'),
    apiFetch<PendingChange[]>('/hierarchy/pending'),
    apiFetch<OwnerOption[]>('/users?role=MANAGER&status=ACTIVE&pageSize=200'),
    apiFetch<OwnerOption[]>('/users?role=ADMIN&status=ACTIVE&pageSize=5'),
  ]);
  const rows = withState(codes.data);
  const active = rows.filter((c) => c.state === 'ACTIVE');
  const advisors = active.reduce((sum, c) => sum + c.activeAdvisors, 0);
  const owners: OwnerOption[] = [...managers.data, ...admins.data].map((o) => ({
    id: o.id,
    fullName: o.fullName,
    role: o.role,
    employeeCode: o.employeeCode ?? null,
  }));
  const withCode = new Set(active.map((c) => c.owner.id));
  const managersWithout = managers.data.filter((m) => !withCode.has(m.id)).length;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Agent codes</h1>
      <StatStrip cols={4}>
        <MiniStat
          label="Active codes"
          value={active.length}
          hint={`${rows.length} created in total`}
          tone={active.length ? 'emerald' : 'slate'}
        />
        <MiniStat
          label="Advisors on a code"
          value={advisors}
          hint="Reporting through an active code"
          tone="sky"
        />
        <MiniStat
          label="Waiting for approval"
          value={pending.data.length}
          hint="Reporting changes"
          tone={pending.data.length ? 'amber' : 'slate'}
        />
        <MiniStat
          label="Managers without a code"
          value={managersWithout}
          hint={`${managers.data.length} active Managers`}
          tone="slate"
        />
      </StatStrip>
      {owners.length ? null : (
        <Callout
          tone="warning"
          icon={ShieldAlert}
          title="No one can own a code yet"
          role="status"
          className="shrink-0"
        >
          An Agent Code must belong to an active Manager or the Admin. Create a Manager first.
        </Callout>
      )}
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-rows-[minmax(0,3fr)_minmax(0,2fr)] lg:overflow-visible">
        <section
          aria-labelledby="agent-codes-title"
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card"
        >
          <div className="grid gap-3 border-b border-border-subtle p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
              <h2 id="agent-codes-title" className="text-sm font-semibold text-foreground">
                Agent codes
              </h2>
              <p className="text-xs text-muted-foreground">
                An Advisor who enters a valid code reports to its owner.
              </p>
            </div>
            <CreateAgentCodeForm owners={owners} />
          </div>
          <div className="min-h-0 flex-1">
            <AgentCodesTable rows={rows} />
          </div>
        </section>
        <section
          aria-labelledby="pending-changes-title"
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border-subtle px-4 py-3">
            <h2 id="pending-changes-title" className="text-sm font-semibold text-foreground">
              Pending reporting changes
            </h2>
            <p className="text-xs text-muted-foreground">
              An Advisor with leads changes reporting person only after Admin approval.
            </p>
          </div>
          <div className="min-h-0 flex-1">
            <PendingChangesTable rows={pending.data} />
          </div>
        </section>
      </div>
    </div>
  );
}
