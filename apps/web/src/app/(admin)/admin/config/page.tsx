import { type ConfigEntry, formatDateTime } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

import { ConfigRowActions } from './config-row-actions';

export default async function ConfigPage() {
  const [cfg, gates] = await Promise.all([
    apiFetch<ConfigEntry[]>('/config'),
    apiFetch<{ key: string; description: string; isSet: boolean }[]>('/config/launch-gates'),
  ]);
  const open = gates.data.filter((g) => !g.isSet);
  const groups = new Map<string, ConfigEntry[]>();
  for (const c of cfg.data) {
    const g = c.key.split('.')[0] ?? 'other';
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuration</h1>
        <p className="text-muted-foreground text-sm">
          Every change needs a reason and is kept in the key&apos;s history and the audit trail. ★ =
          required before production (REQ-28 §28.2 launch gate).
        </p>
      </div>
      <section
        className={`rounded-lg border p-4 ${open.length ? 'border-warning' : 'border-success'}`}
        aria-label="Launch gates"
      >
        <h2 className="font-medium">
          Launch gates: {gates.data.length - open.length} of {gates.data.length} set
        </h2>
        {open.length ? (
          <ul className="text-muted-foreground mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {open.map((g) => (
              <li key={g.key}>
                <a className="font-mono underline" href={`#cfg-${g.key}`}>
                  {g.key}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">All ★ keys hold a value.</p>
        )}
      </section>
      {[...groups.entries()].map(([group, entries]) => (
        <section key={group} className="grid gap-2">
          <h2 className="text-lg font-medium capitalize">{group}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Last change</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((c) => (
                <TableRow key={c.key} id={`cfg-${c.key}`}>
                  <TableCell className="font-mono text-xs">
                    {c.key} {c.requiresValueBeforeProd ? <Badge variant="warning">★</Badge> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.value === null || c.value === undefined ? (
                      <span className="text-muted-foreground">unset</span>
                    ) : (
                      JSON.stringify(c.value)
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xl whitespace-normal text-xs">
                    {c.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {c.updatedAt ? formatDateTime(c.updatedAt) : 'default'}
                  </TableCell>
                  <TableCell>
                    <ConfigRowActions entry={c} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  );
}
