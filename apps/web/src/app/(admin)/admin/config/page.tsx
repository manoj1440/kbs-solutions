import type { ConfigEntry } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

export default async function ConfigPage() {
  const cfg = await apiFetch<ConfigEntry[]>('/config');
  const groups = new Map<string, ConfigEntry[]>();
  for (const c of cfg.data) {
    const g = c.key.split('.')[0] ?? 'other';
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuration</h1>
        <p className="text-muted-foreground text-sm">Read-only view (editing with reason + history drawer lands in F-104 UI). ★ = required before production.</p>
      </div>
      {[...groups.entries()].map(([group, entries]) => (
        <section key={group} className="grid gap-2">
          <h2 className="text-lg font-medium capitalize">{group}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="font-mono text-xs">
                    {c.key} {c.requiresValueBeforeProd ? <Badge variant="warning">★</Badge> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.value === null || c.value === undefined ? <span className="text-muted-foreground">unset</span> : JSON.stringify(c.value)}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xl whitespace-normal text-xs">{c.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  );
}
