import { formatDate, PRIVACY_NOTICE } from '@kbs/shared';
import type { Metadata } from 'next';

import { LegalHeader, NoticeBlock } from '../_components/legal-ui';

export const metadata: Metadata = { title: 'Privacy notice', robots: { index: false, follow: false } };

const isDraft = /draft/i.test(PRIVACY_NOTICE.version);

/** F-908 (DPDP Act 2023 s.5): the same notice text the app shows, from `@kbs/shared`. */
export default function PrivacyPage() {
  const sections = PRIVACY_NOTICE.sections;
  const toc = (
    <ol className="grid gap-0.5 text-ui">
      {sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="block rounded-md px-2 py-1.5 text-fg-2 hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {s.heading}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="grid gap-8">
      <LegalHeader
        title="Privacy notice"
        intro="How KBS Solutions collects, uses, shares and protects personal data, and how you can use your rights."
        meta={`Version ${PRIVACY_NOTICE.version}, updated ${formatDate(PRIVACY_NOTICE.updated)}`}
      />
      {isDraft ? (
        <p role="note" className="max-w-[68ch] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-ui leading-relaxed text-amber-700">
          This is a draft. KBS has not yet approved the final wording, and details marked &ldquo;To be confirmed by KBS&rdquo; are still being filled in.
        </p>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[14rem_1fr] lg:gap-12">
        <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
          <details className="rounded-xl border border-border bg-card px-3 py-2 lg:hidden">
            <summary className="cursor-pointer py-1.5 text-ui font-medium text-foreground">On this page</summary>
            <div className="pt-1 pb-1">{toc}</div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-2 px-2 text-ui font-medium text-foreground">On this page</p>
            {toc}
          </div>
        </nav>
        <article className="grid min-w-0 gap-10 rounded-2xl border border-border bg-card px-5 py-7 sm:px-8 sm:py-9">
          {sections.map((s) => (
            <NoticeBlock key={s.id} section={s} />
          ))}
        </article>
      </div>
    </div>
  );
}
