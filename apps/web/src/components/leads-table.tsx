'use client';

import type { LeadStatusRow } from '@kbs/shared';
import { formatDate, formatDateTime } from '@kbs/shared';
import { ArrowUpRight, ChevronDown, Columns3, LayoutList, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { columnHelper, type ColumnVisibilityState, DataTable } from '@/components/data-table';
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

const c = columnHelper<LeadStatusRow>();

/**
 * F-506 — the REQ-14 §14.2 status table. Stage / Decision / Activation are separate columns with their own badges;
 * the expandable panel shows the remarks preview and raw bank values. There is no "next stage" action (§14.2 row 13).
 * F-813: renders through the common `DataTable` (TanStack v9).
 */
export function LeadsTable({ rows, basePath }: { rows: LeadStatusRow[]; basePath: string }) {
  const [fullTable, setFullTable] = useState(false);
  const columns = c.columns([
    c.accessor((r) => r.customer.name, {
      id: 'customer',
      header: 'Customer / reference',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={row.original.customer.name} size="sm" className="hidden sm:inline-flex" />
          <div className="grid min-w-0 gap-0.5">
            <Link className="truncate font-semibold text-slate-900 hover:text-teal-700" href={`${basePath}/${row.original.id}`}>
              {row.original.customer.name}
            </Link>
            <div className="truncate text-xs text-slate-500 tabular-nums">
              {row.original.customer.mobileMasked ?? ''} · <code>{row.original.kbsRef}</code>
            </div>
          </div>
        </div>
      ),
    }),
    c.accessor((r) => `${r.bank.displayName} ${r.card.name}`, {
      id: 'bankCard',
      header: 'Bank / card',
      cell: ({ row }) => (
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
            <BankMark code={row.original.bank.code} size="sm" className="h-6 min-w-6 shrink-0 text-[7.5px]" />
            <span className="truncate">{row.original.bank.displayName}</span>
          </div>
          <div className="truncate text-xs text-slate-500">
            {row.original.card.name}
            {row.original.card.crosswalked && row.original.card.crosswalked.id !== row.original.card.id
              ? ` · ${row.original.card.crosswalked.productCode} → ${row.original.card.crosswalked.name}`
              : ''}
            {!fullTable && row.original.lastMatchedAt ? ` · MIS ${formatDateTime(row.original.lastMatchedAt)}` : !fullTable ? ' · never matched' : ''}
          </div>
        </div>
      ),
    }),
    c.accessor('kbsRef', {
      header: 'KBS Lead ID',
      cell: ({ getValue }) => <code className="text-xs">{getValue()}</code>,
    }),
    c.accessor('bankApplicationNo', {
      header: 'Bank Application No.',
      cell: ({ row }) =>
        row.original.bankApplicationNo ??
        (row.original.bankReference?.kind === 'APPLICATION_NO' ? (
          <span title="Entered by advisor; not yet verified by MIS">
            {row.original.bankReference.value} <Badge variant="warning">unverified</Badge>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )),
    }),
    c.accessor('bankApplicationReference', {
      header: 'Bank Application Reference',
      cell: ({ row }) =>
        row.original.bankApplicationReference ??
        (row.original.bankReference?.kind === 'APPLICATION_REFERENCE_NUMBER' ? (
          <span>
            {row.original.bankReference.value} <Badge variant="warning">unverified</Badge>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )),
    }),
    c.accessor('leadCreatedAt', {
      header: 'Lead Created',
      sortFn: 'datetime',
      cell: ({ getValue }) => formatDateTime(getValue()),
    }),
    c.accessor((r) => r.bankCreationDate.value ?? '', {
      id: 'bankCreationDate',
      header: 'Bank Creation Date',
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
    }),
    c.accessor((r) => r.stage.display, {
      id: 'stage',
      header: 'Bank stage',
      cell: ({ row }) => <StageBadge field={row.original.stage} label={null} />,
    }),
    c.accessor((r) => r.decision.display, {
      id: 'decision',
      header: 'Bank decision',
      cell: ({ row }) => <DecisionBadge field={row.original.decision} label={null} />,
    }),
    c.accessor((r) => r.activation.display, {
      id: 'activation',
      header: 'Activation',
      cell: ({ row }) => <ActivationBadge field={row.original.activation} label={null} />,
    }),
    c.accessor((r) => r.remarksPreview ?? '', {
      id: 'remarks',
      header: 'Bank Reason / Remarks',
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.remarksPreview ?? (
            <span className="text-muted-foreground">
              {row.original.matched ? 'Not reported' : '—'}
            </span>
          )}
        </span>
      ),
    }),
    c.accessor((r) => r.lastMatchedAt ?? '', {
      id: 'lastMatchedAt',
      header: 'Last Matched MIS Update',
      cell: ({ row }) => <FreshnessLabel lastMatchedAt={row.original.lastMatchedAt} />,
    }),
    c.display({
      id: 'action',
      header: 'Actions',
      meta: { hideLabel: true },
      cell: ({ row }) => (
        <div className="flex items-center justify-start gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={row.getToggleExpandedHandler()}
            aria-expanded={row.getIsExpanded()}
            aria-controls={`lead-details-${row.original.id}`}
            aria-label={row.getIsExpanded() ? `Hide details for ${row.original.customer.name}` : `Show details for ${row.original.customer.name}`}
          >
            <ChevronDown aria-hidden="true" className={row.getIsExpanded() ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </Button>
          <Button asChild size="icon" variant="ghost" className="size-7">
            <Link href={`${basePath}/${row.original.id}`} aria-label={`Open lead ${row.original.customer.name}`}>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ),
    }),
  ]);
  const columnVisibility: ColumnVisibilityState = fullTable
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
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          aria-pressed={fullTable}
          onClick={() => setFullTable((value) => !value)}
        >
          {fullTable ? <LayoutList aria-hidden="true" /> : <Columns3 aria-hidden="true" />}
          {fullTable ? 'Overview layout' : 'All columns'}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        responsive={!fullTable}
        className={fullTable ? 'min-w-[1800px]' : 'lead-overview-table'}
        containerClassName="rounded-none! border-0! lg:h-full lg:overflow-y-auto"
        initialSorting={[{ id: 'leadCreatedAt', desc: true }]}
        columnVisibility={columnVisibility}
        renderSubRow={(row) => <RawPanel row={row.original} />}
        getSubRowId={(row) => `lead-details-${row.id}`}
        getRowProps={(row) => ({ 'data-collision': row.possibleCollision || undefined })}
        emptyRow={
          <EmptyState
            icon={ListChecks}
            title="No leads match."
            description="Try clearing a filter or widening the date range."
          />
        }
      />
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
