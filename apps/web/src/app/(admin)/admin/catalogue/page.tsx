import { Filter } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { DataTablePagination, DataTablePanel } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { selectClass } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { CardModalButton } from './card-modal';
import { type CardRow, CardsTable } from './cards-table';

export const metadata = { title: 'Card catalogue · KBS Solutions' };

const PAGE_SIZE = 20;

/** Catalogue rewrite: one paginated list of cards; create and edit happen in a modal (details, apply link, pincodes, active). */
export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.q?.trim()) qs.set('q', sp.q.trim());
  if (sp.status) qs.set('status', sp.status);
  const [cards, categories] = await Promise.all([
    apiFetch<CardRow[]>(`/catalogue/cards?${qs.toString()}`),
    apiFetch<{ key: string; label: string }[]>('/catalogue/categories').then((r) => r.data),
  ]);
  const total = Number(cards.meta.total ?? cards.data.length);
  const filtered = Boolean(sp.q || sp.status);
  const link = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, status: sp.status, ...over }))
      if (v) q.set(k, v);
    const s = q.toString();
    return `/admin/catalogue${s ? `?${s}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Card catalogue</h1>
      <DataTablePanel
        label="Cards"
        toolbar={
          <>
            <Form
              action="/admin/catalogue"
              className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            >
              <input
                aria-label="Search"
                name="q"
                className={cn(selectClass, 'h-9 min-w-44 flex-[2_1_12rem]')}
                defaultValue={sp.q ?? ''}
                placeholder="Card name"
              />
              <select
                aria-label="Status"
                name="status"
                className={cn(selectClass, 'h-9 min-w-32 flex-[1_1_8rem]')}
                defaultValue={sp.status ?? ''}
              >
                <option value="">Any status</option>
                <option value="PUBLISHED">Active</option>
                <option value="DRAFT">Inactive</option>
                <option value="RETIRED">Retired</option>
              </select>
              <Button type="submit" size="sm" className="h-9">
                <Filter />
                Apply
              </Button>
              {filtered ? (
                <Button asChild size="sm" variant="ghost" className="h-9">
                  <Link href="/admin/catalogue">Reset</Link>
                </Button>
              ) : null}
            </Form>
            <CardModalButton categories={categories} />
          </>
        }
        footer={
          <DataTablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            href={(p) => link({ page: String(p) })}
            noun="cards"
          />
        }
      >
        <CardsTable rows={cards.data} filtered={filtered} categories={categories} />
      </DataTablePanel>
    </div>
  );
}
