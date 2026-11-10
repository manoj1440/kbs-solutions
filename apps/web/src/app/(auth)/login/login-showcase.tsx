/**
 * Login showcase (unslop, 2026-11): what KBS actually does, shown once — a lead whose stage and activation come from
 * the bank's MIS report, with the source tag that runs through the whole workspace. Example data only, aria-hidden.
 */

const ROWS: { label: string; value: string; source: 'Bank MIS' | 'KBS operational' | 'KBS payment' }[] = [
  { label: 'Application stage', value: 'Approved', source: 'Bank MIS' },
  { label: 'Card activation', value: 'Active', source: 'Bank MIS' },
  { label: 'Shared by', value: 'Advisor · Pune', source: 'KBS operational' },
  { label: 'Payout', value: 'Awaiting second approval', source: 'KBS payment' },
];

const SOURCE_DOT: Record<(typeof ROWS)[number]['source'], string> = {
  'Bank MIS': 'bg-provenance-bank-mis',
  'KBS operational': 'bg-provenance-kbs-operational',
  'KBS payment': 'bg-provenance-kbs-payment',
};

export function LoginShowcase() {
  return (
    <section className="relative hidden h-dvh flex-col bg-[#0f0f10] px-10 py-8 text-[#ededed] lg:flex xl:px-14">
      <header className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[hsl(var(--brand-fill))] text-sm font-semibold text-white">
          K
        </span>
        <span className="flex flex-col">
          <span className="text-base leading-5 font-semibold">
            KBS<span className="font-normal text-[#a1a1a6]"> Solutions</span>
          </span>
          <span className="text-xs text-[#85858b]">Credit card DSA platform</span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-12 py-10">
        <div className="max-w-xl">
          <h1 className="text-[44px] leading-[1.08] font-medium tracking-[-0.02em] xl:text-[56px] xl:tracking-[-0.03em]">
            Every lead, settled by the bank&apos;s own report
          </h1>
          <p className="mt-5 max-w-md text-lg leading-7 text-[#a1a1a6]">
            People, bank results and payouts for KBS telecallers, managers and advisors, in one workspace
          </p>
        </div>
        <LeadPreview />
      </div>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#85858b]">
        <span>OTP sign-in</span>
        <span>Role-based access</span>
        <span>Two-person payout approval</span>
        <span className="ml-auto">© KBS Solutions</span>
      </footer>
    </section>
  );
}

/** The one moment on the screen: a rendered card next to the record it belongs to. */
function LeadPreview() {
  return (
    <div aria-hidden="true" className="flex max-w-[640px] items-center gap-6">
      <CardObject />
      <div className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-[#19191b] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Priya Sharma</span>
          <span className="font-mono text-xs text-[#85858b]">KBS-L-4821</span>
        </div>
        <p className="mt-1 text-xs text-[#85858b]">Rewards card · applied 4 Nov</p>
        <dl className="mt-4 divide-y divide-white/6">
          {ROWS.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-xs text-[#a1a1a6]">{r.label}</dt>
              <dd className="flex min-w-0 items-center gap-3 text-right">
                <span className="truncate text-xs text-[#ededed]">{r.value}</span>
                <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-2xs text-[#85858b]">
                  <span className={`size-1.5 rounded-full ${SOURCE_DOT[r.source]}`} />
                  {r.source}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** A credit card drawn as a real object: material gradient, chip, number. The only gradient on the page. */
function CardObject() {
  return (
    <div className="relative hidden aspect-[1.586] w-56 shrink-0 overflow-hidden rounded-xl bg-[linear-gradient(140deg,#f47a45_0%,#f05a28_45%,#b8400f_100%)] p-4 text-white shadow-[0_24px_48px_-16px_rgba(0,0,0,0.6)] xl:block">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.14)_0%,transparent_40%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <span className="text-xs font-medium text-white/85">KBS Advisor</span>
        <span className="h-6 w-8 rounded-md bg-[linear-gradient(135deg,#fde68a,#f59e0b)] ring-1 ring-black/10" />
        <span className="font-mono text-sm text-white/90">•••• •••• •••• 4821</span>
      </div>
    </div>
  );
}
