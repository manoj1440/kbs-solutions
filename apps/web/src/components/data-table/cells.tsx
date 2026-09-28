import { formatDate, formatDateTime } from '@kbs/shared';
import Link from 'next/link';
import * as React from 'react';

import { Avatar, BankMark, humanize } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

/** Muted em-dash for empty values — replaces the repeated `—` spans. */
export function Dash() {
  return <span className="text-slate-400">—</span>;
}

export function DateTimeCell({ value, className }: { value: string | null | undefined; className?: string }) {
  return <span className={cn('text-xs whitespace-nowrap text-slate-600 tabular-nums', className)}>{formatDateTime(value)}</span>;
}
export function DateCell({ value, className }: { value: string | null | undefined; className?: string }) {
  return <span className={cn('text-xs whitespace-nowrap text-slate-600 tabular-nums', className)}>{formatDate(value)}</span>;
}

export function MonoCell({ value, className }: { value: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono text-xs text-slate-600', className)}>{value ?? <Dash />}</span>;
}

/** Avatar + linked name + optional status/code sub-line (users, team-ops, dashboards). */
export function PersonCell({
  name,
  href,
  status,
  code,
  avatarClassName,
}: {
  name: string;
  href?: string;
  status?: string;
  code?: string | null;
  avatarClassName?: string;
}) {
  return (
    <div className="flex min-w-36 items-center gap-2.5">
      <Avatar name={name} size="sm" className={avatarClassName} />
      <div className="min-w-0">
        {href ? (
          <Link className="font-medium" href={href}>
            {name}
          </Link>
        ) : (
          <div className="font-medium">{name}</div>
        )}
        {status || code ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            {status ? <span>{humanize(status)}</span> : null}
            {code ? <span className="font-mono">{code}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Bank monogram + code (MIS applications, dashboards). */
export function BankCell({ code, name }: { code: string; name?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BankMark code={code} size="sm" />
      <span className="text-xs font-medium text-slate-700">{name ?? code}</span>
    </span>
  );
}
