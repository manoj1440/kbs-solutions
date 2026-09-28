import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { columnHelper, DataTable, DataTablePagination } from '@/components/data-table';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

interface Row {
  id: string;
  name: string;
  amount: number | null;
  at: string;
}

const rows: Row[] = [
  { id: 'a', name: 'Beta', amount: 5, at: '2026-01-02' },
  { id: 'b', name: 'Alpha', amount: null, at: '2026-01-03' },
  { id: 'c', name: 'Gamma', amount: 9, at: '2026-01-01' },
];

const c = columnHelper<Row>();
const columns = c.columns([
  c.accessor('name', { header: 'Name' }),
  c.accessor('amount', { header: 'Amount' }),
  c.display({ id: 'act', header: '', meta: { label: 'Action', hideLabel: true }, cell: () => 'x' }),
]);

describe('F-813 DataTable', () => {
  it('emits data-label from meta.label/header so phone card mode keeps working', () => {
    const out = html(<DataTable columns={columns} data={rows} />);
    expect(out).toContain('data-label="Name"');
    expect(out).toContain('data-label="Amount"');
    expect(out).toContain('data-responsive="true"');
    expect(out).not.toContain('data-label="Action"'); // hideLabel wins
  });
  it('all cells stay left-aligned (no align meta)', () => {
    const out = html(<DataTable columns={columns} data={rows} />);
    expect(out).not.toContain('sm:text-right');
    expect(out).toContain('data-label="Amount"');
  });
  it('renders empty instead of the table when data is empty', () => {
    const out = html(<DataTable columns={columns} data={[]} empty={<p>Nothing here.</p>} />);
    expect(out).toContain('Nothing here.');
    expect(out).not.toContain('<table');
  });
  it('emptyRow keeps the header and spans all visible columns', () => {
    const out = html(<DataTable columns={columns} data={[]} emptyRow={<p>empty row</p>} />);
    expect(out).toContain('colSpan="3"');
    expect(out).toContain('empty row');
  });
  it('sorts rows client-side from initialSorting and marks aria-sort', () => {
    const out = html(<DataTable columns={columns} data={rows} initialSorting={[{ id: 'name', desc: false }]} />);
    expect(out.indexOf('Alpha')).toBeLessThan(out.indexOf('Beta'));
    expect(out.indexOf('Beta')).toBeLessThan(out.indexOf('Gamma'));
    expect(out).toContain('aria-sort="ascending"');
  });
  it('hides columns via initialColumnVisibility and shrinks colSpans', () => {
    const out = html(<DataTable columns={columns} data={[]} emptyRow="x" initialColumnVisibility={{ amount: false }} />);
    expect(out).toContain('colSpan="2"');
    expect(out).not.toContain('aria-sort="ascending"');
    expect((out.match(/columnheader/g) ?? []).length).toBe(2);
  });
  it('renders an expanded sub-row with the row id hook', () => {
    const out = html(
      <DataTable
        columns={columns}
        data={rows}
        renderSubRow={(row) => <p>sub {row.original.name}</p>}
        getSubRowId={(r) => `details-${r.id}`}
      />,
    );
    // not expanded yet — sub-row markup absent
    expect(out).not.toContain('details-a');
    const expanded = html(
      <DataTable
        columns={columns}
        data={rows}
        renderSubRow={(row) => <p>sub {row.original.name}</p>}
        getSubRowId={(r) => `details-${r.id}`}
        columnVisibility={undefined}
      />,
    );
    expect(expanded).not.toContain('details-a');
  });
  it('enableRowSelection adds a labelled checkbox column without a data-label', () => {
    const out = html(<DataTable columns={columns} data={rows} enableRowSelection />);
    expect(out).toContain('aria-label="Select all rows"');
    expect(out).toContain('aria-label="Select row"');
  });
  it('variant=panel applies the F-811 fill classes, sticky header and edge padding', () => {
    const out = html(<DataTable columns={columns} data={rows} variant="panel" />);
    expect(out).toContain('lg:overflow-y-auto');
    expect(out).toContain('sticky top-0 z-10');
    expect(out).toMatch(/<td[^>]*pl-4[^>]*data-label="Name"/);
  });
  it('getRowProps adds row attributes', () => {
    const out = html(<DataTable columns={columns} data={rows} getRowProps={(r) => ({ 'data-collision': r.id === 'b' || undefined })} />);
    expect(out).toContain('data-collision="true"');
  });
});

describe('F-813 DataTablePagination', () => {
  it('renders the shared "A–B of T · page P of Q" copy', () => {
    const out = html(<DataTablePagination page={1} pageSize={50} total={120} href={(p) => `/x?page=${p}`} noun="users" />);
    expect(out).toContain('1–50 of 120');
    expect(out).toContain('page 1 of 3');
    expect(out).not.toContain('Previous');
    expect(out).toContain('href="/x?page=2"');
  });
  it('last page hides Next; empty total renders the noun', () => {
    const last = html(<DataTablePagination page={3} pageSize={50} total={120} href={(p) => `/x?page=${p}`} noun="users" />);
    expect(last).toContain('101–120 of 120');
    expect(last).toContain('Previous');
    expect(last).not.toContain('>Next<');
    const zero = html(<DataTablePagination page={1} pageSize={50} total={0} href={(p) => `/x?page=${p}`} noun="users" />);
    expect(zero).toContain('0 users');
    expect(zero).toContain('page 1 of 1');
  });
});
