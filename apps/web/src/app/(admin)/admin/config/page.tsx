import { type ConfigEntry, formatDateTime } from '@kbs/shared';
import {
  Archive,
  CircleCheck,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  Files,
  GraduationCap,
  History,
  IdCard,
  KeyRound,
  LifeBuoy,
  ListChecks,
  type LucideIcon,
  Network,
  Palette,
  Phone,
  Rocket,
  ScrollText,
  Settings2,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Star,
  TriangleAlert,
  Wallet,
  Wifi,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Callout,
  Meter,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  type Tone,
} from '@/components/ui/kit';
import { apiFetch } from '@/lib/api';

import { ConfigRowActions } from './config-row-actions';

/** Section label, icon and tone per key prefix (presentation only; unknown prefixes fall back to the prefix itself). */
const GROUP: Record<string, { label: string; icon: LucideIcon; tone: Tone }> = {
  allocation: { label: 'Allocation', icon: Shuffle, tone: 'violet' },
  audit: { label: 'Audit', icon: ScrollText, tone: 'slate' },
  auth: { label: 'Auth', icon: KeyRound, tone: 'teal' },
  calling: { label: 'Calling', icon: Phone, tone: 'sky' },
  catalogue: { label: 'Catalogue', icon: CreditCard, tone: 'indigo' },
  compliance: { label: 'Compliance', icon: ShieldCheck, tone: 'rose' },
  files: { label: 'Files', icon: Files, tone: 'slate' },
  hierarchy: { label: 'Hierarchy', icon: Network, tone: 'violet' },
  idcard: { label: 'ID card', icon: IdCard, tone: 'indigo' },
  leads: { label: 'Leads', icon: ListChecks, tone: 'teal' },
  mis: { label: 'MIS', icon: FileSpreadsheet, tone: 'indigo' },
  network: { label: 'Network', icon: Wifi, tone: 'sky' },
  onboarding: { label: 'Onboarding', icon: ClipboardCheck, tone: 'emerald' },
  payouts: { label: 'Payouts', icon: Wallet, tone: 'emerald' },
  retention: { label: 'Retention', icon: Archive, tone: 'amber' },
  support: { label: 'Support', icon: LifeBuoy, tone: 'sky' },
  training: { label: 'Training', icon: GraduationCap, tone: 'violet' },
  ux: { label: 'UX', icon: Palette, tone: 'slate' },
};
const groupMeta = (g: string) =>
  GROUP[g] ?? {
    label: g.charAt(0).toUpperCase() + g.slice(1),
    icon: Settings2,
    tone: 'slate' as Tone,
  };

type Flat = Record<string, unknown>;
const isFlat = (o: unknown): o is Flat =>
  !!o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.values(o).every((x) => x === null || typeof x !== 'object');
const pill =
  'rounded-md bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-800 ring-1 ring-slate-200 ring-inset';

/** One flat JSON object as `key: value` lines (values stay JSON, wrapping only between words). */
function FlatObject({ value }: { value: Flat }) {
  return (
    <dl className={`${pill} grid gap-0.5 py-1.5`}>
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-slate-500">{k}:</dt>
          <dd className="min-w-0 break-words">{JSON.stringify(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The stored value, shown exactly as JSON (never reworded). Arrays become chips; flat objects become key/value lines. */
function ConfigValue({ entry }: { entry: ConfigEntry }) {
  const v = entry.value;
  if (v === null || v === undefined)
    return (
      <span className="inline-flex rounded-md border border-dashed border-slate-300 px-2 py-0.5 font-mono text-xs text-slate-400 italic">
        unset
      </span>
    );
  const json = JSON.stringify(v);
  if (typeof v === 'object' && Object.keys(v).length === 0)
    return <code className={`${pill} inline-block`}>{json}</code>;
  if (Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object'))
    return (
      <span className="flex flex-wrap gap-1" title={json}>
        {v.map((x, i) => (
          <code key={i} className={`${pill} break-words whitespace-pre-wrap`}>
            {JSON.stringify(x)}
          </code>
        ))}
      </span>
    );
  if (Array.isArray(v) && v.every(isFlat))
    return (
      <div className="grid max-h-64 gap-1.5 overflow-auto" title={json}>
        {v.map((x, i) => (
          <FlatObject key={i} value={x} />
        ))}
      </div>
    );
  if (isFlat(v)) return <FlatObject value={v} />;
  if (typeof v === 'object')
    return (
      <pre
        className={`${pill} block max-h-64 overflow-auto py-1.5 leading-relaxed break-words whitespace-pre-wrap`}
      >
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  if (typeof v === 'boolean')
    return (
      <code
        className={`${pill} inline-flex items-center gap-1.5 ${v ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : ''}`}
      >
        <span
          className={`size-1.5 rounded-full ${v ? 'bg-emerald-500' : 'bg-slate-400'}`}
          aria-hidden="true"
        />
        {json}
      </code>
    );
  return (
    <code
      className={`${pill} inline-block tabular-nums [overflow-wrap:anywhere] whitespace-pre-wrap`}
    >
      {json}
    </code>
  );
}

/** Config key with a break opportunity after each dot, so long keys wrap at segments rather than mid-word. */
function Key({ name }: { name: string }) {
  return (
    <>
      {name.split('.').map((part, i) => (
        <span key={i}>
          {i ? '.' : ''}
          {i ? <wbr /> : null}
          {part}
        </span>
      ))}
    </>
  );
}

/** F-104 Admin: every config key grouped by prefix, with the REQ-28 §28.2 launch-gate status. */
export default async function ConfigPage() {
  const [cfg, gates] = await Promise.all([
    apiFetch<ConfigEntry[]>('/config'),
    apiFetch<{ key: string; description: string; isSet: boolean }[]>('/config/launch-gates'),
  ]);
  const open = gates.data.filter((g) => !g.isSet);
  const setCount = gates.data.length - open.length;
  const groups = new Map<string, ConfigEntry[]>();
  for (const c of cfg.data) {
    const g = c.key.split('.')[0] ?? 'other';
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  const changed = cfg.data.filter((c) => c.updatedAt).length;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Settings2}
        eyebrow="Settings"
        title="Configuration"
        tone="slate"
        description={
          <>
            Every change needs a reason and is kept in the key&apos;s history and the audit trail. ★
            = required before production (REQ-28 §28.2 launch gate).
          </>
        }
      >
        <StatGrid>
          <StatCard
            label="Launch gates"
            icon={Rocket}
            tone={open.length ? 'amber' : 'emerald'}
            value={
              <>
                {setCount}
                <span className="text-base font-medium text-slate-400">
                  {' '}
                  of {gates.data.length} set
                </span>
                <Meter
                  value={setCount}
                  max={gates.data.length}
                  tone={open.length ? 'amber' : 'emerald'}
                  className="mt-2.5"
                  label="Launch gates set"
                />
              </>
            }
            hint={
              open.length
                ? `${open.length} ★ key${open.length === 1 ? '' : 's'} still unset`
                : 'All ★ keys hold a value.'
            }
          />
          <StatCard
            label="Settings"
            value={cfg.data.length}
            hint={`Across ${groups.size} sections`}
            icon={SlidersHorizontal}
            tone="indigo"
          />
          <StatCard
            label="Changed by an Admin"
            value={changed}
            hint="Each change has a reason in its history"
            icon={History}
            tone="sky"
          />
          <StatCard
            label="Never changed"
            value={cfg.data.length - changed}
            hint="Still the seeded default"
            icon={Settings2}
            tone="slate"
          />
        </StatGrid>
      </PageHeader>

      <section aria-label="Launch gates">
        {open.length ? (
          <Callout
            tone="warning"
            icon={TriangleAlert}
            title={`Launch gates: ${setCount} of ${gates.data.length} set`}
          >
            <p>These ★ keys need a value before production:</p>
            <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5">
              {open.map((g) => (
                <li key={g.key} className="min-w-0">
                  <a
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-white px-2 py-0.5 font-mono text-xs break-all text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                    href={`#cfg-${g.key}`}
                    title={g.description}
                  >
                    <Star className="size-3 shrink-0" aria-hidden="true" />
                    {g.key}
                  </a>
                </li>
              ))}
            </ul>
          </Callout>
        ) : (
          <Callout
            tone="success"
            icon={CircleCheck}
            title={`Launch gates: ${setCount} of ${gates.data.length} set`}
          >
            All ★ keys hold a value.
          </Callout>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[12.5rem_minmax(0,1fr)] xl:items-start">
        <nav aria-label="Configuration sections" className="xl:sticky xl:top-24">
          <p className="mb-2 hidden px-1 text-[10.5px] font-semibold tracking-[0.16em] text-slate-500 uppercase xl:block">
            Sections
          </p>
          <ul className="flex flex-wrap gap-1.5 xl:grid xl:gap-0.5">
            {[...groups.entries()].map(([group, entries]) => {
              const m = groupMeta(group);
              const Icon = m.icon;
              return (
                <li key={group}>
                  <a
                    href={`#cfg-group-${group}`}
                    className="inline-flex h-8 w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 text-[13px] font-medium text-slate-600 shadow-[0_1px_2px_rgb(15_23_42/4%)] transition-colors hover:border-slate-300 hover:text-slate-900 xl:border-transparent xl:bg-transparent xl:shadow-none xl:hover:bg-white"
                  >
                    <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{m.label}</span>
                    <span className="ml-auto rounded-full bg-slate-100 px-1.5 text-[10.5px] font-semibold text-slate-500 tabular-nums">
                      {entries.length}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="grid min-w-0 gap-6">
          {[...groups.entries()].map(([group, entries]) => {
            const m = groupMeta(group);
            const stars = entries.filter((c) => c.requiresValueBeforeProd).length;
            return (
              <SectionCard
                key={group}
                id={`cfg-group-${group}`}
                icon={m.icon}
                tone={m.tone}
                title={m.label}
                description={`${entries.length} key${entries.length === 1 ? '' : 's'}${stars ? ` · ${stars} ★ required before production` : ''}`}
                flush
              >
                <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_10.5rem_9.5rem] gap-4 border-y border-slate-100 bg-slate-50 px-6 py-2.5 text-[10.5px] font-semibold tracking-[0.06em] text-slate-500 uppercase lg:grid">
                  <span>Key · description</span>
                  <span>Value</span>
                  <span>Last change</span>
                  <span className="sr-only">Actions</span>
                </div>
                <ul className="divide-y divide-slate-100 border-t border-slate-100 lg:border-t-0">
                  {entries.map((c) => (
                    <li
                      key={c.key}
                      id={`cfg-${c.key}`}
                      className="grid scroll-mt-24 gap-2.5 px-5 py-3.5 target:bg-amber-50/60 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_10.5rem_9.5rem] lg:gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[12.5px] font-medium [overflow-wrap:anywhere] text-slate-900">
                            <Key name={c.key} />
                          </span>
                          {c.requiresValueBeforeProd ? (
                            <Badge
                              variant="warning"
                              className="px-1.5 leading-4"
                              title="Required before production (REQ-28 §28.2 launch gate)"
                            >
                              ★
                            </Badge>
                          ) : null}
                          <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold tracking-wide text-slate-500">
                            {c.valueType}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {c.description}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <ConfigValue entry={c} />
                      </div>
                      <div className="text-xs text-slate-500 lg:pt-0.5 lg:whitespace-nowrap">
                        <span className="text-[10.5px] font-semibold tracking-wide text-slate-400 uppercase lg:hidden">
                          Last change ·{' '}
                        </span>
                        {c.updatedAt ? formatDateTime(c.updatedAt) : 'default'}
                      </div>
                      <div className="min-w-0 lg:justify-self-end lg:has-[[data-editing]]:col-span-3 lg:has-[[data-editing]]:col-start-2 lg:has-[[data-editing]]:justify-self-stretch">
                        <ConfigRowActions entry={c} />
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
