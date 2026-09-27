'use client';

import { ApiClientError } from '@kbs/shared';
import { ArrowLeft, BadgeCheck, BookCheck, Columns3, FileSpreadsheet, Info, KeyRound, Layers, Lock, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BankMark, Callout, EmptyState, Field, humanize, PageHeader, SectionCard, selectClass, StatCard, StatGrid } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

export interface MisProfile {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'RETIRED';
  sheetSelector: string | null;
  headerAliases: Record<string, string[]>;
  fieldMap: Record<string, string>;
  referenceFields: { kind: string; header: string }[];
  snapshotMode: 'DELTA' | 'FULL_SNAPSHOT';
  blankOverwrites: boolean;
  timezone: string;
  timezoneAssumed: boolean;
  dateFormats: string[] | null;
  knownValues: Record<string, string[]> | null;
  bank: { code: string; displayName: string };
  internalFields: { text: string[]; date: string[] };
}

/** F-501 §4 profile editor: internal field → exact raw header, references in order, semantics, known values. */
export function MisProfileEditor({ initial }: { initial: MisProfile }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>(initial.fieldMap);
  const [refs, setRefs] = useState(initial.referenceFields.map((r) => `${r.kind}=${r.header}`).join('\n'));
  const [aliases, setAliases] = useState(Object.entries(initial.headerAliases ?? {}).map(([k, v]) => `${k}=${v.join('|')}`).join('\n'));
  const [form, setForm] = useState({ name: initial.name, sheetSelector: initial.sheetSelector ?? '', snapshotMode: initial.snapshotMode, blankOverwrites: initial.blankOverwrites, timezone: initial.timezone, dateFormats: (initial.dateFormats ?? []).join('\n') });
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const readOnly = p.status === 'RETIRED';
  const fail = (e: unknown, fb: string) => setMsg(e instanceof ApiClientError ? e.message : fb);
  const save = async () => {
    setMsg(null);
    try {
      const referenceFields = refs.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [kind, ...h] = l.split('='); return { kind: kind.trim(), header: h.join('=').trim() }; });
      const headerAliases = Object.fromEntries(aliases.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [k, v] = l.split('='); return [k.trim(), (v ?? '').split('|').map((x) => x.trim()).filter(Boolean)]; }));
      const r = await clientApi.patch<MisProfile>(`/mis/profiles/${p.id}`, { name: form.name, sheetSelector: form.sheetSelector || null, fieldMap: Object.fromEntries(Object.entries(fieldMap).filter(([, v]) => v.trim())), referenceFields, headerAliases, snapshotMode: form.snapshotMode, blankOverwrites: form.blankOverwrites, timezone: form.timezone, dateFormats: form.dateFormats.split('\n').map((s) => s.trim()).filter(Boolean) });
      if (r.data.id !== p.id) {
        router.push(`/admin/mis/profiles/${r.data.id}`);
        return;
      }
      setP(r.data);
      setMsg('Saved.');
      router.refresh();
    } catch (e) {
      fail(e, 'Could not save.');
    }
  };
  const allFields = [...p.internalFields.text, ...p.internalFields.date];
  const mappedCount = allFields.filter((f) => (fieldMap[f] ?? '').trim()).length;
  const known = Object.entries(p.knownValues ?? {});
  const knownCount = known.reduce((n, [, v]) => n + v.length, 0);
  const area = 'min-h-20 w-full rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-900 disabled:bg-slate-50 disabled:text-slate-500';
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={FileSpreadsheet}
        eyebrow="Bank MIS"
        title={
          <>
            {p.bank.displayName} — {p.name}
          </>
        }
        description="MIS import profile: how this bank's workbook headers map to KBS fields, which references identify a lead, and how blanks and dates are read."
        meta={
          <>
            <BankMark code={p.bank.code} size="sm" />
            <Badge variant={p.status === 'APPROVED' ? 'success' : p.status === 'DRAFT' ? 'warning' : 'unknown'}>
              {humanize(p.status)} · v{p.version}
            </Badge>
            <span>{humanize(p.snapshotMode)} mode</span>
            <span>· {p.timezone}</span>
          </>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/mis">
              <ArrowLeft />
              MIS imports
            </Link>
          </Button>
        }
      >
        <StatGrid>
          <StatCard label="Mapped fields" value={`${mappedCount} / ${allFields.length}`} hint="Internal fields with a bank header" icon={Columns3} tone="indigo" />
          <StatCard label="Reference fields" value={p.referenceFields.length} hint="Matched exactly, in profile order" icon={KeyRound} tone="teal" />
          <StatCard label="Known values" value={knownCount} hint={`Across ${known.length} field${known.length === 1 ? '' : 's'}`} icon={BookCheck} tone="violet" />
          <StatCard label="Snapshot mode" value={humanize(p.snapshotMode)} hint={p.blankOverwrites ? 'Blank cells overwrite earlier values' : 'Blank = "Not reported"'} icon={Layers} tone="sky" />
        </StatGrid>
      </PageHeader>
      {msg ? (
        <Callout tone="neutral" icon={Info} role="status">
          {msg}
        </Callout>
      ) : null}
      {readOnly ? (
        <Callout tone="neutral" icon={Lock}>
          {humanize(p.status)} profile — fields are read-only.
        </Callout>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <SectionCard
          icon={Columns3}
          tone="indigo"
          title="Column mapping"
          description="Internal field → header exactly as the bank writes it (misspellings included). Unmapped columns are still kept in raw."
          flush
        >
          <div className="grid border-t border-slate-100 bg-slate-50/70 px-5 py-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-3 sm:px-6">
            <span>Internal field</span>
            <span className="hidden sm:block">Bank header</span>
          </div>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {allFields.map((f) => {
              const on = Boolean((fieldMap[f] ?? '').trim());
              return (
                <li key={f} className="grid items-center gap-1.5 px-5 py-2.5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-3 sm:px-6">
                  <label htmlFor={`fm-${f}`} className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-700">
                    <span className={cn('size-1.5 shrink-0 rounded-full', on ? 'bg-teal-500' : 'bg-slate-300')} aria-hidden="true" />
                    <span className="min-w-0 font-mono break-all">{f}</span>
                    {p.internalFields.date.includes(f) ? <span className="shrink-0 rounded bg-sky-50 px-1 py-px text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100"> (date)</span> : ''}
                  </label>
                  <Input id={`fm-${f}`} disabled={readOnly} className="h-8 text-xs" placeholder="not mapped" value={fieldMap[f] ?? ''} onChange={(e) => setFieldMap({ ...fieldMap, [f]: e.target.value })} />
                </li>
              );
            })}
          </ul>
        </SectionCard>
        <div className="grid content-start gap-6">
          <SectionCard icon={KeyRound} tone="teal" title="Identifiers & semantics" description="References are matched exactly (bank + value) in this order. Nothing else is ever used to match.">
            <div className="grid gap-4">
              <Field label="Name" htmlFor="pname">
                <Input id="pname" disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Sheet selector (blank = first)" htmlFor="psheet">
                <Input id="psheet" disabled={readOnly} value={form.sheetSelector} onChange={(e) => setForm({ ...form, sheetSelector: e.target.value })} />
              </Field>
              <Field label="Reference fields (KIND=Header, one per line)" htmlFor="prefs">
                <textarea id="prefs" disabled={readOnly} className={area} value={refs} onChange={(e) => setRefs(e.target.value)} />
              </Field>
              <Field label="Header aliases (Header=alt1|alt2)" htmlFor="palias">
                <textarea id="palias" disabled={readOnly} className={area} value={aliases} onChange={(e) => setAliases(e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Snapshot mode" htmlFor="pmode">
                  <select id="pmode" disabled={readOnly} className={selectClass} value={form.snapshotMode} onChange={(e) => setForm({ ...form, snapshotMode: e.target.value as 'DELTA' })}>
                    <option value="DELTA">DELTA (partial file)</option>
                    <option value="FULL_SNAPSHOT">FULL_SNAPSHOT (absence is meaningful)</option>
                  </select>
                </Field>
                <Field label="Timezone" htmlFor="ptz">
                  <Input id="ptz" disabled={readOnly} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
                </Field>
              </div>
              <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700">
                <input type="checkbox" className="mt-0.5 size-4 accent-teal-700" disabled={readOnly} checked={form.blankOverwrites} onChange={(e) => setForm({ ...form, blankOverwrites: e.target.checked })} />
                Blank cells overwrite earlier values (default off: blank = &quot;Not reported&quot;)
              </label>
              <Field label="Date formats (one per line)" htmlFor="pdates">
                <textarea id="pdates" disabled={readOnly} className={area} value={form.dateFormats} onChange={(e) => setForm({ ...form, dateFormats: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <Button disabled={readOnly} onClick={save}>
                  <Save />
                  {p.status === 'APPROVED' ? 'Save as new version' : 'Save'}
                </Button>
                {p.status === 'DRAFT' ? (
                  <>
                    <Input id="approve-reason" className="min-w-0 flex-1 sm:max-w-xs" placeholder="approval reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button
                      variant="outline"
                      disabled={reason.trim().length < 3}
                      onClick={async () => {
                        try {
                          const r = await clientApi.post<MisProfile>(`/mis/profiles/${p.id}/approve`, { reason });
                          setP(r.data);
                          setMsg('Approved — imports for this bank now run under this version.');
                          router.refresh();
                        } catch (e) {
                          fail(e, 'Could not approve.');
                        }
                      }}
                    >
                      <BadgeCheck />
                      Approve
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </SectionCard>
          <SectionCard icon={BookCheck} tone="violet" title="Known values" description="Values observed so far per field. New values in a file are flagged in preview and stored verbatim — never translated.">
            {known.length ? (
              <div className="grid gap-3">
                {known.map(([f, vals]) => (
                  <div key={f} className="grid gap-1.5">
                    <p className="font-mono text-xs font-semibold text-slate-700">{f}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vals.map((v) => (
                        <span key={v} className="rounded-md bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 ring-1 ring-slate-200">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={BookCheck} title="None recorded." className="py-6" />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
