import { formatInr } from '@kbs/shared';
import { Building2, CreditCard, Link2, Link2Off } from 'lucide-react';
import Link from 'next/link';

import { CreditCardArt } from '@/components/card-art';
import { Badge } from '@/components/ui/badge';
import { BankMark, EmptyState, humanize, MiniStat } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { BankActions, NewCardForm } from './actions';

export const metadata = { title: 'Card catalogue · KBS Solutions' };

interface Bank {
  id: string;
  code: string;
  displayName: string;
  active: boolean;
  _count: { cards: number };
}
interface CardRow {
  id: string;
  name: string;
  status: string;
  version: number;
  bank: { code: string; displayName: string };
  categories: { key: string; label: string }[];
  effectiveChannels: string[];
  joiningFee: number | null;
  annualFee: number | null;
}

const STATUS: Record<string, 'info' | 'success' | 'unknown'> = { DRAFT: 'info', PUBLISHED: 'success', RETIRED: 'unknown' };
const fee = (v: number | null) => (v == null ? '—' : formatInr(v, { decimals: 0 }));

/** F-403 → F-811 Admin: banks + cards, compact tiles + internal scroll. */
export default async function CataloguePage() {
  const [banks, cards] = await Promise.all([apiFetch<Bank[]>('/catalogue/banks?includeInactive=true'), apiFetch<CardRow[]>('/catalogue/cards')]);
  const published = cards.data.filter((c) => c.status === 'PUBLISHED');
  const offered = published.filter((c) => c.effectiveChannels.length > 0).length;
  const drafts = cards.data.filter((c) => c.status === 'DRAFT').length;
  const activeBanks = banks.data.filter((b) => b.active).length;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Card catalogue</h1>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Cards" value={cards.data.length} hint={`${published.length} published`} tone="sky" />
        <MiniStat label="Offerable now" value={offered} hint="Published with an application link" tone="emerald" />
        <MiniStat label="Drafts" value={drafts} hint="Not offered until published" tone={drafts ? 'amber' : 'slate'} />
        <MiniStat label="Active banks" value={activeBanks} hint={`${banks.data.length} in total`} tone="indigo" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          <section aria-label="Cards" className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
            {cards.data.length === 0 ? (
              <EmptyState icon={CreditCard} className="m-3" title="No cards yet" description="Create a draft card alongside, fill its details on the card page, then publish." />
            ) : (
              <ul className="grid gap-3 p-3 sm:grid-cols-2 2xl:grid-cols-3">
                {cards.data.map((c) => {
                  const muted = c.status !== 'PUBLISHED';
                  return (
                    <li key={c.id} className="min-w-0">
                      <Link
                        href={`/admin/catalogue/${c.id}`}
                        prefetch={false}
                        className="lift group flex h-full flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      >
                        <CreditCardArt bankCode={c.bank.code} bankName={c.bank.displayName} cardName={c.name} muted={muted} />
                        <div className="grid gap-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 group-hover:text-teal-800">{c.name}</p>
                              <p className="text-xs text-slate-500">{c.bank.displayName}</p>
                            </div>
                            <Badge variant={STATUS[c.status] ?? 'unknown'}>
                              {humanize(c.status)} v{c.version}
                            </Badge>
                          </div>
                          {c.categories.length ? (
                            <div className="flex flex-wrap gap-1">
                              {c.categories.map((x) => (
                                <span key={x.key} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                  {x.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400">No categories</p>
                          )}
                          <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-3 py-2">
                            <div>
                              <dt className="text-[10.5px] font-medium tracking-wide text-slate-500 uppercase">Joining fee</dt>
                              <dd className="text-sm font-semibold text-slate-800 tabular-nums">{fee(c.joiningFee)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10.5px] font-medium tracking-wide text-slate-500 uppercase">Annual fee</dt>
                              <dd className="text-sm font-semibold text-slate-800 tabular-nums">{fee(c.annualFee)}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                          <span className="text-[10.5px] font-medium tracking-wide text-slate-500 uppercase">Link</span>
                          {c.effectiveChannels.length ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              {c.effectiveChannels.map((ch) => (
                                <Badge key={ch} variant="success">
                                  <Link2 />
                                  {humanize(ch)}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="destructive">
                              <Link2Off />
                              No effective link
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <div className="grid content-start gap-3">
            <section aria-label="Banks" className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
              {banks.data.length === 0 ? (
                <EmptyState icon={Building2} title="No banks yet" description="Add the first bank with the form below." />
              ) : (
                <ul className="grid gap-2">
                  {banks.data.map((b) => (
                    <li key={b.id} className={cn('flex min-w-0 items-center gap-3 rounded-xl border p-2.5', b.active ? 'border-slate-200/80 bg-white' : 'border-dashed border-slate-200 bg-slate-50/70')}>
                      <BankMark code={b.code} className={cn(!b.active && 'grayscale opacity-60')} />
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-sm leading-snug font-semibold', b.active ? 'text-slate-900' : 'text-slate-500')}>{b.displayName}</p>
                        <p className="text-[11px] text-slate-500">
                          <span className="font-mono">{b.code}</span> · <span className="tabular-nums">{b._count.cards}</span> card{b._count.cards === 1 ? '' : 's'}
                        </p>
                      </div>
                      <BankActions id={b.id} active={b.active} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <NewCardForm banks={banks.data.filter((b) => b.active).map((b) => ({ id: b.id, label: b.displayName }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
