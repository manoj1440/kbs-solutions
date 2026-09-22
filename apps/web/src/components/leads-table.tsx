'use client';

import type { LeadStatusRow } from '@kbs/shared';
import { formatDate, formatDateTime } from '@kbs/shared';
import { type ColumnDef, type ExpandedState, flexRender, getCoreRowModel, getExpandedRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import Link from 'next/link';
import { Fragment, useState } from 'react';

import { ActivationBadge, DecisionBadge, FreshnessLabel, ProvenanceChip, StageBadge } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * F-506 — the REQ-14 §14.2 status table. Stage / Decision / Activation are separate columns with their own badges;
 * the expandable panel shows the remarks preview and raw bank values. There is no "next stage" action (§14.2 row 13).
 */
export function LeadsTable({ rows, basePath }: { rows: LeadStatusRow[]; basePath: string }) {
  'use no memo'; // TanStack Table returns unstable functions; React Compiler must skip this component.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'leadCreatedAt', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columns: ColumnDef<LeadStatusRow>[] = [
    { id: 'customer', header: 'Customer', accessorFn: (r) => r.customer.name, cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.customer.name}</div>
          <div className="text-muted-foreground text-xs">{row.original.customer.mobileMasked ?? ''}</div>
        </div>
      ) },
    { id: 'bankCard', header: 'Bank / Credit card', accessorFn: (r) => `${r.bank.displayName} ${r.card.name}`, cell: ({ row }) => (
        <div>
          <div>{row.original.bank.displayName}</div>
          <div className="text-muted-foreground text-xs">
            {row.original.card.name}
            {row.original.card.crosswalked && row.original.card.crosswalked.id !== row.original.card.id ? ` · bank product ${row.original.card.crosswalked.productCode} → ${row.original.card.crosswalked.name}` : ''}
          </div>
        </div>
      ) },
    { id: 'kbsRef', header: 'KBS Lead ID', accessorKey: 'kbsRef', cell: ({ getValue }) => <code className="text-xs">{getValue<string>()}</code> },
    { id: 'bankApplicationNo', header: 'Bank Application No.', accessorKey: 'bankApplicationNo', cell: ({ row }) => row.original.bankApplicationNo ?? (row.original.bankReference?.kind === 'APPLICATION_NO' ? <span title="Entered by advisor; not yet verified by MIS">{row.original.bankReference.value} <Badge variant="warning">unverified</Badge></span> : <span className="text-muted-foreground">—</span>) },
    { id: 'bankApplicationReference', header: 'Bank Application Reference', accessorKey: 'bankApplicationReference', cell: ({ row }) => row.original.bankApplicationReference ?? (row.original.bankReference?.kind === 'APPLICATION_REFERENCE_NUMBER' ? <span>{row.original.bankReference.value} <Badge variant="warning">unverified</Badge></span> : <span className="text-muted-foreground">—</span>) },
    { id: 'leadCreatedAt', header: 'Lead Created', accessorKey: 'leadCreatedAt', cell: ({ getValue }) => formatDateTime(getValue<string>()) },
    { id: 'bankCreationDate', header: 'Bank Creation Date', accessorFn: (r) => r.bankCreationDate.value ?? '', cell: ({ row }) => (row.original.bankCreationDate.value ? <span title={`Source column: ${row.original.bankCreationDate.source}`}>{formatDate(row.original.bankCreationDate.value)} <span className="text-muted-foreground text-[10px]">({row.original.bankCreationDate.source})</span></span> : <span className="text-muted-foreground">{row.original.matched ? 'Not reported' : 'Awaiting MIS Update'}</span>) },
    { id: 'stage', header: 'Current Application Stage', accessorFn: (r) => r.stage.display, cell: ({ row }) => <StageBadge field={row.original.stage} /> },
    { id: 'decision', header: 'Final Bank Decision', accessorFn: (r) => r.decision.display, cell: ({ row }) => <DecisionBadge field={row.original.decision} /> },
    { id: 'activation', header: 'Card Activation', accessorFn: (r) => r.activation.display, cell: ({ row }) => <ActivationBadge field={row.original.activation} /> },
    { id: 'remarks', header: 'Bank Reason / Remarks', accessorFn: (r) => r.remarksPreview ?? '', cell: ({ row }) => <span className="text-xs">{row.original.remarksPreview ?? <span className="text-muted-foreground">{row.original.matched ? 'Not reported' : '—'}</span>}</span> },
    { id: 'lastMatchedAt', header: 'Last Matched MIS Update', accessorFn: (r) => r.lastMatchedAt ?? '', cell: ({ row }) => <FreshnessLabel lastMatchedAt={row.original.lastMatchedAt} /> },
    { id: 'action', header: 'Action', enableSorting: false, cell: ({ row }) => (
        <div className="flex gap-1">
          <Button asChild size="sm" variant="outline">
            <Link href={`${basePath}/${row.original.id}`}>Open details</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={row.getToggleExpandedHandler()} aria-expanded={row.getIsExpanded()}>
            {row.getIsExpanded() ? 'Hide' : 'Raw'}
          </Button>
        </div>
      ) },
  ];
  const table = useReactTable({ data: rows, columns, state: { sorting, expanded }, onSortingChange: setSorting, onExpandedChange: setExpanded, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getExpandedRowModel: getExpandedRowModel(), getRowCanExpand: () => true });
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id} className="whitespace-nowrap">
                {h.isPlaceholder ? null : h.column.getCanSort() ? (
                  <button type="button" className="inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    <span className="text-muted-foreground text-[10px]">{h.column.getIsSorted() === 'asc' ? '▲' : h.column.getIsSorted() === 'desc' ? '▼' : ''}</span>
                  </button>
                ) : (
                  flexRender(h.column.columnDef.header, h.getContext())
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-muted-foreground text-center">
              No leads match.
            </TableCell>
          </TableRow>
        ) : null}
        {table.getRowModel().rows.map((row) => (
          <Fragment key={row.id}>
            <TableRow data-collision={row.original.possibleCollision || undefined}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
            {row.getIsExpanded() ? (
              <TableRow className="bg-muted/30">
                <TableCell colSpan={columns.length}>
                  <RawPanel row={row.original} />
                </TableCell>
              </TableRow>
            ) : null}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

function RawPanel({ row }: { row: LeadStatusRow }) {
  return (
    <div className="grid gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceChip provenance="BANK_MIS" asOf={row.lastMatchedAt} batchRef={row.stage.batchRef} />
        {!row.matched ? <span className="text-muted-foreground">No accepted MIS row has matched this lead yet; nothing below is inferred.</span> : null}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">CURRENT_STAGE (raw)</dt>
        <dd>{row.stage.raw ?? <em>blank</em>}</dd>
        <dt className="text-muted-foreground">FINAL_DECISION (raw)</dt>
        <dd>{row.decision.raw ?? <em>blank</em>}</dd>
        <dt className="text-muted-foreground">Card Activation Staus (raw)</dt>
        <dd>{row.activation.raw ?? <em>blank</em>}</dd>
        <dt className="text-muted-foreground">Bank reason preview</dt>
        <dd>{row.remarksPreview ?? <em>none reported</em>}</dd>
        <dt className="text-muted-foreground">Bank reference (KBS linkage)</dt>
        <dd>{row.bankReference ? `${row.bankReference.kind} ${row.bankReference.value} · ${row.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'verified by MIS match' : 'unverified'}` : 'not yet available'}</dd>
        <dt className="text-muted-foreground">Authorised actions</dt>
        <dd>{row.actions.map((a) => a.toLowerCase().replace(/_/g, ' ')).join(' · ')}</dd>
      </dl>
    </div>
  );
}
