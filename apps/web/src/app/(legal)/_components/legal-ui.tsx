import { LEGAL_FALLBACK, type NoticeSection } from '@kbs/shared';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * F-908 legal pages: plain reading layout on the F-821 canvas. Server-safe.
 * A legal fact still unknown (`LEGAL_FALLBACK`) is drawn as an amber "pending" value, so a draft never reads as final.
 */

export function LegalHeader({ title, intro, meta }: { title: string; intro?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <header className="grid gap-3 border-b border-border-subtle pb-6">
      <h1 className="text-[28px] leading-9 font-semibold text-foreground sm:text-[34px] sm:leading-[42px]">{title}</h1>
      {intro ? <p className="max-w-[62ch] text-base leading-7 text-fg-2">{intro}</p> : null}
      {meta ? <p className="text-ui text-muted-foreground">{meta}</p> : null}
    </header>
  );
}

/** A fact value: the real value, or the fallback marked as pending. */
export function Fact({ value }: { value: string }) {
  if (value !== LEGAL_FALLBACK) return <span className="break-words text-foreground">{value}</span>;
  return <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700">{value}</span>;
}

/** `Label: value` list items become a definition row; anything else stays a plain bullet. */
function splitFact(item: string): [string, string] | null {
  const i = item.indexOf(': ');
  if (i <= 0 || i > 40) return null;
  return [item.slice(0, i), item.slice(i + 2)];
}

export function FactList({ facts }: { facts: [string, string][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-border bg-surface-muted px-4 py-3 text-base sm:grid-cols-[minmax(9rem,max-content)_1fr]">
      {facts.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="mb-1 min-w-0 sm:mb-0">
            <Fact value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid max-w-[68ch] gap-4 text-base leading-7 text-fg-2', className)}>{children}</div>;
}

export function LegalSection({ id, heading, children }: { id: string; heading: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-20 gap-3">
      <h2 id={`${id}-h`} className="text-lg font-semibold text-foreground">
        {heading}
      </h2>
      <Prose>{children}</Prose>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="grid list-disc gap-1.5 pl-5 marker:text-fg-3">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/** Notice sections whose items are company facts (`Label: value`), drawn as a definition list. */
const FACT_SECTIONS = new Set(['who-we-are', 'grievance-officer']);

/** Renders one notice section: paragraphs, then items as facts (when every item is `Label: value`) or bullets. */
export function NoticeBlock({ section }: { section: NoticeSection }) {
  const facts = section.items?.map(splitFact);
  const allFacts = FACT_SECTIONS.has(section.id) && facts && facts.length > 0 && facts.every((f) => f !== null);
  return (
    <LegalSection id={section.id} heading={section.heading}>
      {section.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {section.items?.length ? allFacts ? <FactList facts={facts as [string, string][]} /> : <Bullets items={section.items} /> : null}
    </LegalSection>
  );
}

export const linkClass = 'font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40';
