import { formatInr } from '@kbs/shared';
import { Building2, CheckCircle2, CreditCard, FilePen, Link2, Link2Off } from 'lucide-react';
import Link from 'next/link';

import { CreditCardArt } from '@/components/card-art';
import { Badge } from '@/components/ui/badge';
import { BankMark, EmptyState, humanize, PageHeader, SectionCard, StatCard, StatGrid } from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import { BankActions, NewCardForm } from './actions';

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

/** F-403 Admin: banks + cards. */
export default async function CataloguePage() {
  const [banks, cards] = await Promise.all([apiFetch<Bank[]>('/catalogue/banks?includeInactive=true'), apiFetch<CardRow[]>('/catalogue/cards')]);
  const published = cards.data.filter((c) => c.status === 'PUBLISHED');
  const offered = published.filter((c) => c.effectiveChannels.length > 0).length;
  const drafts = cards.data.filter((c) => c.status === 'DRAFT').length;
  const activeBanks = banks.data.filter((b) => b.active).length;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={CreditCard}
        eyebrow="Products"
        title="Card catalogue"
        description="Only PUBLISHED cards with an effective application link are offered to Telecallers and Advisors. Copy that promises approval is blocked at publish (REQ-11 §11.3)."
      >
        <StatGrid>
          <StatCard label="Cards" value={cards.data.length} hint={`${published.length} published`} icon={CreditCard} tone="teal" />
          <StatCard label="Offerable now" value={offered} hint="Published with an effective application link" icon={CheckCircle2} tone="emerald" />
          <StatCard label="Drafts" value={drafts} hint="Not offered until published" icon={FilePen} tone={drafts ? 'amber' : 'slate'} />
          <StatCard label="Active banks" value={activeBanks} hint={`${banks.data.length} bank${banks.data.length === 1 ? '' : 's'} in total`} icon={Building2} tone="indigo" />
        </StatGrid>
      </PageHeader>
      <SectionCard icon={CreditCard} tone="teal" title="Cards" description={`${cards.data.length} cards.`}>
        {cards.data.length === 0 ? (
          <EmptyState icon={CreditCard} title="No cards yet" description="Create a draft card below, fill its details on the card page, then publish." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {cards.data.map((c) => {
              const muted = c.status !== 'PUBLISHED';
              return (
                <li key={c.id} className="min-w-0">
                  <Link
                    href={`/admin/catalogue/${c.id}`}
                    prefetch={false}
                    className="lift group flex h-full flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <CreditCardArt bankCode={c.bank.code} bankName={c.bank.displayName} cardName={c.name} muted={muted} />
                    <div className="grid gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 group-hover:text-teal-800">{c.name}</p>
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
                    <div className="mt-auto border-t border-slate-100 pt-3">
                      <p className="mb-1.5 text-[10.5px] font-medium tracking-wide text-slate-500 uppercase">Effective link channels</p>
                      {c.effectiveChannels.length ? (
                        <div className="flex flex-wrap gap-1">
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
      </SectionCard>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <SectionCard icon={Building2} tone="indigo" title="Banks" description={`${banks.data.length} banks. Use the active / inactive button to toggle a bank.`}>
          {banks.data.length === 0 ? (
            <EmptyState icon={Building2} title="No banks yet" description="Add the first bank with the form alongside." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {banks.data.map((b) => (
                <li key={b.id} className={cn('flex min-w-0 items-center gap-3 rounded-xl border p-3', b.active ? 'border-slate-200/80 bg-white' : 'border-dashed border-slate-200 bg-slate-50/70')}>
                  <BankMark code={b.code} className={cn(!b.active && 'grayscale opacity-60')} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm leading-snug font-semibold break-words', b.active ? 'text-slate-900' : 'text-slate-500')}>{b.displayName}</p>
                    <p className="text-[11px] text-slate-500">
                      <span className="font-mono">{b.code}</span> · <span className="tabular-nums">{b._count.cards}</span> card{b._count.cards === 1 ? '' : 's'}
                    </p>
                  </div>
                  <BankActions id={b.id} active={b.active} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <NewCardForm banks={banks.data.filter((b) => b.active).map((b) => ({ id: b.id, label: b.displayName }))} />
      </div>
    </div>
  );
}
