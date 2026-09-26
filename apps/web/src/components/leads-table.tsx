'use client';

import type { LeadStatusRow } from '@kbs/shared';
import { formatDate, formatDateTime } from '@kbs/shared';
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronDown, Columns3, LayoutList, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState } from 'react';

import {
  ActivationBadge,
  DecisionBadge,
  FreshnessLabel,
  ProvenanceChip,
  StageBadge,
} from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, BankMark, EmptyState, KeyValueGrid } from '@/components/ui/kit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * F-506 — the REQ-14 §14.2 status table. Stage / Decision / Activation are separate columns with their own badges;
 * the expandable panel shows the remarks preview and raw bank values. There is no "next stage" action (§14.2 row 13).
 */
export function LeadsTable({ rows, basePath }: { rows: LeadStatusRow[]; basePath: string }) {
  'use no memo'; // TanStack Table returns unstable functions; React Compiler must skip this component.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'leadCreatedAt', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [fullTable, setFullTable] = useState(false);
  const columns: ColumnDef<LeadStatusRow>[] = [
    {
      id: 'customer',
      header: 'Customer / reference',
      accessorFn: (r) => r.customer.name,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-start gap-2.5">
          <Avatar name={row.original.customer.name} size="sm" className="mt-0.5 hidden sm:inline-flex" />
          <div className="grid min-w-0 gap-0.5">
            <Link className="font-semibold" href={`${basePath}/${row.original.id}`}>
              {row.original.customer.name}
            </Link>
            <div className="text-xs text-slate-500 tabular-nums">
              {row.original.customer.mobileMasked ?? ''}
            </div>
            {!fullTable ? (
              <code className="text-[11px] text-slate-500">{row.original.kbsRef}</code>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'bankCard',
      header: 'Bank / card',
      accessorFn: (r) => `${r.bank.displayName} ${r.card.name}`,
      cell: ({ row }) => (
        <div className="grid min-w-0 gap-0.5">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            {/* lead rows carry no bank code; the first word of the name matches the code for current banks */}
            <BankMark code={row.original.bank.displayName.split(' ')[0].toUpperCase()} size="sm" className="hidden h-6 min-w-6 text-[7.5px] sm:inline-flex" />
            {row.original.bank.displayName}
          </div>
          <div className="text-xs text-slate-500">
            {row.original.card.name}
            {row.original.card.crosswalked &&
            row.original.card.crosswalked.id !== row.original.card.id
              ? ` · bank product ${row.original.card.crosswalked.productCode} → ${row.original.card.crosswalked.name}`
              : ''}
          </div>
          {!fullTable ? <FreshnessLabel lastMatchedAt={row.original.lastMatchedAt} /> : null}
        </div>
      ),
    },
    {
      id: 'kbsRef',
      header: 'KBS Lead ID',
      accessorKey: 'kbsRef',
      cell: ({ getValue }) => <code className="text-xs">{getValue<string>()}</code>,
    },
    {
      id: 'bankApplicationNo',
      header: 'Bank Application No.',
      accessorKey: 'bankApplicationNo',
      cell: ({ row }) =>
        row.original.bankApplicationNo ??
        (row.original.bankReference?.kind === 'APPLICATION_NO' ? (
          <span title="Entered by advisor; not yet verified by MIS">
            {row.original.bankReference.value} <Badge variant="warning">unverified</Badge>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )),
    },
    {
      id: 'bankApplicationReference',
      header: 'Bank Application Reference',
      accessorKey: 'bankApplicationReference',
      cell: ({ row }) =>
        row.original.bankApplicationReference ??
        (row.original.bankReference?.kind === 'APPLICATION_REFERENCE_NUMBER' ? (
          <span>
            {row.original.bankReference.value} <Badge variant="warning">unverified</Badge>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )),
    },
    {
      id: 'leadCreatedAt',
      header: 'Lead Created',
      accessorKey: 'leadCreatedAt',
      cell: ({ getValue }) => formatDateTime(getValue<string>()),
    },
    {
      id: 'bankCreationDate',
      header: 'Bank Creation Date',
      accessorFn: (r) => r.bankCreationDate.value ?? '',
      cell: ({ row }) =>
        row.original.bankCreationDate.value ? (
          <span title={`Source column: ${row.original.bankCreationDate.source}`}>
            {formatDate(row.original.bankCreationDate.value)}{' '}
            <span className="text-muted-foreground text-[10px]">
              ({row.original.bankCreationDate.source})
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {row.original.matched ? 'Not reported' : 'Awaiting MIS Update'}
          </span>
        ),
    },
    {
      id: 'stage',
      header: 'Bank stage',
      accessorFn: (r) => r.stage.display,
      cell: ({ row }) => <StageBadge field={row.original.stage} />,
    },
    {
      id: 'decision',
      header: 'Bank decision',
      accessorFn: (r) => r.decision.display,
      cell: ({ row }) => <DecisionBadge field={row.original.decision} />,
    },
    {
      id: 'activation',
      header: 'Activation',
      accessorFn: (r) => r.activation.display,
      cell: ({ row }) => <ActivationBadge field={row.original.activation} />,
    },
    {
      id: 'remarks',
      header: 'Bank Reason / Remarks',
      accessorFn: (r) => r.remarksPreview ?? '',
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.remarksPreview ?? (
            <span className="text-muted-foreground">
              {row.original.matched ? 'Not reported' : '—'}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'lastMatchedAt',
      header: 'Last Matched MIS Update',
      accessorFn: (r) => r.lastMatchedAt ?? '',
      cell: ({ row }) => <FreshnessLabel lastMatchedAt={row.original.lastMatchedAt} />,
    },
    {
      id: 'action',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Button asChild size="sm" variant="outline">
            <Link href={`${basePath}/${row.original.id}`}>
              Open lead
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={row.getToggleExpandedHandler()}
            aria-expanded={row.getIsExpanded()}
            aria-controls={`lead-details-${row.original.id}`}
          >
            {row.getIsExpanded() ? 'Less detail' : 'More detail'}
            <ChevronDown aria-hidden="true" className={row.getIsExpanded() ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </Button>
        </div>
      ),
    },
  ];
  const columnVisibility: Record<string, boolean> = fullTable
    ? {}
    : {
        kbsRef: false,
        bankApplicationNo: false,
        bankApplicationReference: false,
        leadCreatedAt: false,
        bankCreationDate: false,
        remarks: false,
        lastMatchedAt: false,
      };
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, expanded, columnVisibility },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });
  const visibleColumns = table.getVisibleLeafColumns().length;
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {fullTable
            ? 'All 13 fields. Scroll sideways for additional columns, or switch to the overview.'
            : 'Key information fits this panel. More detail shows bank references, dates and remarks.'}
        </p>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={fullTable}
          onClick={() => setFullTable((value) => !value)}
        >
          {fullTable ? <LayoutList aria-hidden="true" /> : <Columns3 aria-hidden="true" />}
          {fullTable ? 'Overview layout' : 'Full table view'}
        </Button>
      </div>
      <Table
        responsive={!fullTable}
        className={fullTable ? 'min-w-[1800px]' : 'lead-overview-table'}
      >
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === 'asc' ? (
                        <ArrowUp className="size-3 text-teal-700" aria-hidden="true" />
                      ) : h.column.getIsSorted() === 'desc' ? (
                        <ArrowDown className="size-3 text-teal-700" aria-hidden="true" />
                      ) : null}
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
              <TableCell colSpan={visibleColumns} className="p-4">
                <EmptyState
                  icon={ListChecks}
                  title="No leads match."
                  description="Try clearing a filter or widening the date range."
                />
              </TableCell>
            </TableRow>
          ) : null}
          {table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <TableRow data-collision={row.original.possibleCollision || undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    data-label={String(cell.column.columnDef.header)}
                    className="align-top"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {row.getIsExpanded() ? (
                <TableRow id={`lead-details-${row.original.id}`} className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableCell colSpan={visibleColumns}>
                    <RawPanel row={row.original} />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RawPanel({ row }: { row: LeadStatusRow }) {
  const awaiting = row.matched ? 'Not reported' : 'Awaiting MIS Update';
  const blank = <em className="text-slate-400">blank</em>;
  return (
    <div className="grid gap-4 rounded-xl border border-slate-200/80 bg-white p-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceChip
          provenance="BANK_MIS"
          asOf={row.lastMatchedAt}
          batchRef={row.stage.batchRef}
        />
        {!row.matched ? (
          <span className="text-slate-500">
            No accepted MIS row has matched this lead yet; nothing below is inferred.
          </span>
        ) : null}
      </div>
      <KeyValueGrid
        cols={3}
        className="[&_dd]:text-[12.5px]"
        items={[
          ['KBS Lead ID', <code key="k">{row.kbsRef}</code>],
          ['Bank Application No.', row.bankApplicationNo ?? awaiting],
          ['Bank Application Reference', row.bankApplicationReference ?? awaiting],
          ['KBS lead created', formatDateTime(row.leadCreatedAt)],
          [
            'Bank creation date',
            row.bankCreationDate.value
              ? `${formatDateTime(row.bankCreationDate.value)} · ${row.bankCreationDate.source}`
              : awaiting,
          ],
          ['CURRENT_STAGE (raw)', row.stage.raw ?? blank],
          ['FINAL_DECISION (raw)', row.decision.raw ?? blank],
          ['Card Activation Staus (raw)', row.activation.raw ?? blank],
          ['Bank reason preview', row.remarksPreview ?? <em className="text-slate-400">none reported</em>],
          [
            'Bank reference (KBS linkage)',
            row.bankReference
              ? `${row.bankReference.kind} ${row.bankReference.value} · ${row.bankReference.status === 'VERIFIED_BY_MIS_MATCH' ? 'verified by MIS match' : 'unverified'}`
              : 'not yet available',
          ],
          ['Authorised actions', row.actions.map((a) => a.toLowerCase().replace(/_/g, ' ')).join(' · ')],
        ]}
      />
    </div>
  );
}
