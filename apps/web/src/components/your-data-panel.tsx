import { DATA_REQUEST_STATUS_LABEL, DATA_REQUEST_TYPE_LABEL, type DataRequestView, formatDate } from '@kbs/shared';
import { ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Callout, SectionCard } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { YourDataActions } from './your-data-actions';

const STATUS_VARIANT = { OPEN: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success', REJECTED: 'secondary' } as const;

/**
 * F-908 "Your data" on the web account page (every web role): download a copy of your own data, file a request and see
 * the requests you have sent with KBS's replies.
 */
export async function YourDataPanel() {
  const rows = await apiFetch<DataRequestView[]>('/privacy/requests/mine')
    .then((r) => r.data)
    .catch(() => null);
  return (
    <SectionCard icon={ShieldCheck} title="Your data" description="Download what KBS holds about you, or ask KBS to correct or delete it.">
      <div className="grid gap-5">
        <YourDataActions activeTypes={(rows ?? []).filter((r) => r.status === 'OPEN' || r.status === 'IN_PROGRESS').map((r) => r.type)} />
        {rows === null ? (
          <Callout tone="danger">Your requests could not be loaded. Reload the page to try again.</Callout>
        ) : rows.length ? (
          <ul className="grid gap-2" aria-label="Your requests">
            {rows.map((r) => (
              <li key={r.id} className="grid gap-1.5 rounded-xl bg-surface-muted p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{DATA_REQUEST_TYPE_LABEL[r.type]}</span>
                  <Badge variant={STATUS_VARIANT[r.status]}>{DATA_REQUEST_STATUS_LABEL[r.status]}</Badge>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  <span className="font-mono">{r.publicRef}</span>, sent {formatDate(r.createdAt)}
                  {r.closedAt ? `, closed ${formatDate(r.closedAt)}` : ''}
                </span>
                {r.resolutionNote ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg-2">{r.resolutionNote}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No requests yet. Anything you send appears here with its status.</p>
        )}
      </div>
    </SectionCard>
  );
}
