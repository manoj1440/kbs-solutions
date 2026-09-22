import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

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

/** F-403 Admin: banks + cards. */
export default async function CataloguePage() {
  const [banks, cards] = await Promise.all([apiFetch<Bank[]>('/catalogue/banks?includeInactive=true'), apiFetch<CardRow[]>('/catalogue/cards')]);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Card catalogue</h1>
        <p className="text-muted-foreground text-sm">Only PUBLISHED cards with an effective application link are offered to Telecallers and Advisors. Copy that promises approval is blocked at publish (REQ-11 §11.3).</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Banks</CardTitle>
            <CardDescription>{banks.data.length} banks.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Cards</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.data.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.code}</TableCell>
                    <TableCell>{b.displayName}</TableCell>
                    <TableCell>{b._count.cards}</TableCell>
                    <TableCell>
                      <BankActions id={b.id} active={b.active} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <NewCardForm banks={banks.data.filter((b) => b.active).map((b) => ({ id: b.id, label: b.displayName }))} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cards</CardTitle>
          <CardDescription>{cards.data.length} cards.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Fees (joining / annual)</TableHead>
                <TableHead>Effective link channels</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link className="underline" href={`/admin/catalogue/${c.id}`}>
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{c.bank.displayName}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS[c.status] ?? 'unknown'}>
                      {c.status} v{c.version}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{c.categories.map((x) => x.label).join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {c.joiningFee ?? '—'} / {c.annualFee ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs">{c.effectiveChannels.join(', ') || <span className="text-destructive">none</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
