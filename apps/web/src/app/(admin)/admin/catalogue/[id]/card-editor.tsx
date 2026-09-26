'use client';

import { ApiClientError, amountInput, digitsOnly, formatDateTime, formatInr } from '@kbs/shared';
import { Archive, FilePen, FileText, ImageIcon, Info, Link2, Link2Off, MapPin, Plus, Rocket, Save, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CreditCardArt } from '@/components/card-art';
import { FileUploadButton } from '@/components/file-upload-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BankMark, Callout, EmptyState, Field, humanize, KeyValueGrid, PageHeader, SectionCard, selectClass } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

const areaClass =
  'min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-[inset_0_1px_1px_rgb(15_23_42/3%)] outline-none hover:border-slate-300 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60';

export interface CardDetail {
  id: string;
  name: string;
  productCode: string | null;
  description: string | null;
  benefits: string[] | null;
  joiningFee: number | null;
  annualFee: number | null;
  majorCharges: { label: string; value: string }[] | null;
  eligibilityHighlights: string | null;
  disclosures: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  version: number;
  forbiddenPhraseOverride: string | null;
  bank: { id: string; code: string; displayName: string };
  categories: { key: string; label: string }[];
  image: { id: string; originalName: string } | null;
  benefitPdf: { id: string; originalName: string } | null;
  links: { id: string; channel: string; url: string; version: number; effectiveFrom: string; effectiveTo: string | null; live: boolean }[];
  effectiveChannels: string[];
}

export interface Publication {
  id: string;
  channel: string;
  pincode: string | null;
  state: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export function CardEditor({ initial, categories, initialPublications }: { initial: CardDetail; categories: { key: string; label: string }[]; initialPublications: Publication[] }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [pubs, setPubs] = useState(initialPublications);
  const [pub, setPub] = useState({ channel: 'BOTH', scope: 'GLOBAL', pincode: '', state: '' });
  const reloadPubs = async () => setPubs((await clientApi.get<Publication[]>(`/catalogue/cards/${c.id}/publications`)).data);
  const [form, setForm] = useState({
    name: initial.name,
    productCode: initial.productCode ?? '',
    description: initial.description ?? '',
    benefits: (initial.benefits ?? []).join('\n'),
    joiningFee: initial.joiningFee?.toString() ?? '',
    annualFee: initial.annualFee?.toString() ?? '',
    majorCharges: (initial.majorCharges ?? []).map((m) => `${m.label}: ${m.value}`).join('\n'),
    eligibilityHighlights: initial.eligibilityHighlights ?? '',
    disclosures: initial.disclosures ?? '',
    categoryKeys: initial.categories.map((x) => x.key),
  });
  const [link, setLink] = useState({ channel: 'BOTH', url: '' });
  const [override, setOverride] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<string[]>([]);
  const readOnly = c.status === 'RETIRED';
  const fail = (e: unknown, fb: string) => setMsg(e instanceof ApiClientError ? e.message : fb);
  const refresh = async () => {
    const r = await clientApi.get<CardDetail>(`/catalogue/cards/${c.id}`);
    setC(r.data);
    router.refresh();
  };
  const save = async () => {
    setMsg(null);
    try {
      await clientApi.patch(`/catalogue/cards/${c.id}`, {
        name: form.name,
        productCode: form.productCode || null,
        description: form.description || null,
        benefits: form.benefits.split('\n').map((s) => s.trim()).filter(Boolean),
        joiningFee: form.joiningFee === '' ? null : Number(form.joiningFee),
        annualFee: form.annualFee === '' ? null : Number(form.annualFee),
        majorCharges: form.majorCharges
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const [label, ...rest] = s.split(':');
            return { label: label.trim(), value: rest.join(':').trim() || '—' };
          }),
        eligibilityHighlights: form.eligibilityHighlights || null,
        disclosures: form.disclosures || null,
        categoryKeys: form.categoryKeys,
      });
      await refresh();
      setMsg('Saved.');
    } catch (e) {
      fail(e, 'Could not save.');
    }
  };
  const publish = async () => {
    setMsg(null);
    setForbidden([]);
    try {
      await clientApi.post(`/catalogue/cards/${c.id}/publish`, override ? { overrideReason: override } : {});
      await refresh();
      setOverride('');
      setMsg('Published.');
    } catch (e) {
      const d = e instanceof ApiClientError ? (e.error.details as { forbiddenPhrases?: string[] } | undefined) : undefined;
      if (d?.forbiddenPhrases) setForbidden(d.forbiddenPhrases);
      fail(e, 'Could not publish.');
    }
  };
  const field = (key: keyof typeof form, label: string, textarea = false, mask?: (v: string) => string) => (
    <Field label={label} htmlFor={`f-${key}`}>
      {textarea ? (
        <textarea id={`f-${key}`} disabled={readOnly} className={areaClass} value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      ) : (
        <Input id={`f-${key}`} disabled={readOnly} inputMode={mask ? 'decimal' : undefined} value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: mask ? mask(e.target.value) : e.target.value })} />
      )}
    </Field>
  );
  const liveLinks = c.links.filter((l) => l.live).length;
  const openPubs = pubs.filter((x) => !x.effectiveTo).length;
  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%),0_4px_16px_-8px_rgb(15_23_42/8%)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgb(20_184_166/10%),transparent_65%)]" />
        <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,19rem)_1fr]">
          <CreditCardArt bankCode={c.bank.code} bankName={c.bank.displayName} cardName={c.name} muted={c.status !== 'PUBLISHED'} className="max-w-[19rem]" />
          <div className="grid min-w-0 gap-5">
            <PageHeader
              eyebrow="Sales operations · Card catalogue"
              title={c.name}
              meta={
                <>
                  <Badge variant={c.status === 'PUBLISHED' ? 'success' : c.status === 'DRAFT' ? 'info' : 'unknown'}>
                    {humanize(c.status)} v{c.version}
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                    <BankMark code={c.bank.code} size="sm" />
                    {c.bank.displayName}
                  </span>
                </>
              }
            />
            <KeyValueGrid
              cols={4}
              className="grid-cols-2"
              items={[
                ['Joining fee', <span key="j" className="font-semibold tabular-nums">{c.joiningFee == null ? '—' : formatInr(c.joiningFee, { decimals: 0 })}</span>],
                ['Annual fee', <span key="a" className="font-semibold tabular-nums">{c.annualFee == null ? '—' : formatInr(c.annualFee, { decimals: 0 })}</span>],
                ['Live links', <span key="l" className="font-semibold tabular-nums">{liveLinks}</span>],
                ['Open publications', <span key="p" className="font-semibold tabular-nums">{openPubs}</span>],
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Effective channels</span>
              {c.effectiveChannels.length ? (
                c.effectiveChannels.map((ch) => (
                  <Badge key={ch} variant="success">
                    <Link2 />
                    {humanize(ch)}
                  </Badge>
                ))
              ) : (
                <Badge variant="destructive">
                  <Link2Off />
                  No effective link
                </Badge>
              )}
            </div>
          </div>
        </div>
      </section>
      {msg ? (
        <Callout tone="neutral" icon={Info} role="status">
          {msg}
        </Callout>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={FilePen} tone="teal" title="Basics, benefits & fees" description="REQ-07 §7.1 fields. One benefit per line; charges as “label: value”." className="self-start">
          <div className="grid gap-4">
            {field('name', 'Card name')}
            {field('productCode', 'Bank product code (for MIS crosswalk)')}
            {field('description', 'Description', true)}
            {field('benefits', 'Rewards / benefits (one per line)', true)}
            <div className="grid gap-4 sm:grid-cols-2">
              {field('joiningFee', 'Joining fee (₹)', false, amountInput)}
              {field('annualFee', 'Annual fee (₹)', false, amountInput)}
            </div>
            {field('majorCharges', 'Major charges (label: value per line)', true)}
            {field('eligibilityHighlights', 'Eligibility highlights', true)}
            {field('disclosures', 'Disclosures', true)}
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-[12px] font-medium text-slate-600">Categories</legend>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const on = form.categoryKeys.includes(cat.key);
                  return (
                    <label
                      key={cat.key}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                        on ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      )}
                    >
                      <input type="checkbox" className="accent-teal-700" disabled={readOnly} checked={on} onChange={(e) => setForm({ ...form, categoryKeys: e.target.checked ? [...form.categoryKeys, cat.key] : form.categoryKeys.filter((k) => k !== cat.key) })} />
                      {cat.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="border-t border-slate-100 pt-4">
              <Button disabled={readOnly} onClick={save}>
                <Save />
                Save details
              </Button>
            </div>
          </div>
        </SectionCard>
        <div className="grid content-start gap-6">
          <SectionCard icon={ImageIcon} tone="sky" title="Assets" description="Card image and benefit PDF (files module).">
            <ul className="grid gap-2 text-sm">
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <ImageIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0 break-all">
                    <span className="text-slate-500">Image: </span>
                    {c.image?.originalName ?? '—'}
                  </span>
                </span>
                <FileUploadButton
                  purpose="card_image"
                  accept="image/*"
                  label="Upload image"
                  onUploaded={async (f) => {
                    await clientApi.patch(`/catalogue/cards/${c.id}`, { imageFileId: f.id });
                    await refresh();
                  }}
                />
              </li>
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <FileText className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0 break-all">
                    <span className="text-slate-500">Benefit PDF: </span>
                    {c.benefitPdf?.originalName ?? '—'}
                  </span>
                </span>
                <FileUploadButton
                  purpose="benefit_pdf"
                  accept="application/pdf"
                  label="Upload PDF"
                  onUploaded={async (f) => {
                    await clientApi.patch(`/catalogue/cards/${c.id}`, { benefitPdfFileId: f.id });
                    await refresh();
                  }}
                />
              </li>
            </ul>
          </SectionCard>
          <SectionCard icon={Link2} tone="indigo" title="Application links" description="Stored exactly as pasted (tracking strings and fragments preserved). One effective link per channel; adding a new one closes the previous.">
            <div className="grid gap-3">
              {c.links.length === 0 ? (
                <Callout tone="warning" icon={Link2Off}>
                  No links yet — the card cannot be offered until one is effective.
                </Callout>
              ) : (
                <ul className="grid gap-2 text-xs">
                  {c.links.map((l) => {
                    const live = l.live;
                    return (
                      <li key={l.id} className={cn('grid gap-1.5 rounded-xl border px-3 py-2.5', live ? 'border-emerald-200/70 bg-emerald-50/30' : 'border-slate-200/80 bg-slate-50/50')}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant={live ? 'success' : 'unknown'}>
                            {humanize(l.channel)} v{l.version}
                          </Badge>
                          {live ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const reason = window.prompt('Reason for ending this link?');
                                if (!reason) return;
                                try {
                                  await clientApi.post(`/catalogue/links/${l.id}/end`, { reason });
                                  await refresh();
                                } catch (e) {
                                  fail(e, 'Could not end the link.');
                                }
                              }}
                            >
                              End
                            </Button>
                          ) : null}
                        </div>
                        <span className="font-mono break-all text-slate-800">{l.url}</span>
                        <span className="text-slate-500 tabular-nums">
                          {formatDateTime(l.effectiveFrom)} → {l.effectiveTo ? formatDateTime(l.effectiveTo) : 'open'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!readOnly ? (
                <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[9rem_1fr_auto]">
                  <select aria-label="channel" className={selectClass} value={link.channel} onChange={(e) => setLink({ ...link, channel: e.target.value })}>
                    <option value="BOTH">Both</option>
                    <option value="TELECALLER">Telecaller</option>
                    <option value="ADVISOR">Advisor</option>
                  </select>
                  <Input id="link-url" placeholder="https://…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
                  <Button
                    disabled={!/^https?:\/\//i.test(link.url)}
                    onClick={async () => {
                      try {
                        await clientApi.post(`/catalogue/cards/${c.id}/links`, link);
                        setLink({ ...link, url: '' });
                        await refresh();
                        setMsg('Link added.');
                      } catch (e) {
                        fail(e, 'Could not add the link.');
                      }
                    }}
                  >
                    <Plus />
                    Add link
                  </Button>
                </div>
              ) : null}
            </div>
          </SectionCard>
          <SectionCard icon={MapPin} tone="violet" title="Where this card is offered (F-308)" description="A published card is offered for a customer pincode only when the bank is sourceable there AND a publication covers it: globally, by state (via pincode master), or by exact pincode.">
            <div className="grid gap-3">
              {pubs.length === 0 ? (
                <EmptyState icon={MapPin} title="Not offered anywhere yet." className="py-6" />
              ) : (
                <ul className="grid gap-2 text-xs">
                  {pubs.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200/80 px-3 py-2">
                      <Badge variant={x.effectiveTo && new Date(x.effectiveTo) <= new Date(x.effectiveFrom) ? 'unknown' : x.effectiveTo ? 'warning' : 'success'}>{humanize(x.channel)}</Badge>
                      <span className="font-medium text-slate-800">{x.pincode ? `pincode ${x.pincode}` : x.state ? `state ${x.state}` : 'global'}</span>
                      <span className="text-slate-500 tabular-nums">
                        {formatDateTime(x.effectiveFrom)} → {x.effectiveTo ? formatDateTime(x.effectiveTo) : 'open'}
                      </span>
                      {!x.effectiveTo ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto"
                          onClick={async () => {
                            const reason = window.prompt('Reason for ending this publication?');
                            if (!reason) return;
                            try {
                              await clientApi.post(`/catalogue/publications/${x.id}/end`, { reason });
                              await reloadPubs();
                            } catch (e) {
                              fail(e, 'Could not end the publication.');
                            }
                          }}
                        >
                          End
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {!readOnly ? (
                <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[8rem_8rem_1fr_auto]">
                  <select aria-label="publication channel" className={selectClass} value={pub.channel} onChange={(e) => setPub({ ...pub, channel: e.target.value })}>
                    <option value="BOTH">Both</option>
                    <option value="TELECALLER">Telecaller</option>
                    <option value="ADVISOR">Advisor</option>
                  </select>
                  <select aria-label="publication scope" className={selectClass} value={pub.scope} onChange={(e) => setPub({ ...pub, scope: e.target.value })}>
                    <option value="GLOBAL">Global</option>
                    <option value="STATE">State</option>
                    <option value="PINCODE">Pincode</option>
                  </select>
                  {pub.scope === 'PINCODE' ? <Input id="pub-pincode" inputMode="numeric" placeholder="302001" value={pub.pincode} onChange={(e) => setPub({ ...pub, pincode: digitsOnly(e.target.value, 6) })} /> : pub.scope === 'STATE' ? <Input id="pub-state" placeholder="Rajasthan" value={pub.state} onChange={(e) => setPub({ ...pub, state: e.target.value })} /> : <span className="hidden sm:block" />}
                  <Button
                    id="pub-add"
                    variant="outline"
                    disabled={(pub.scope === 'PINCODE' && !/^\d{6}$/.test(pub.pincode)) || (pub.scope === 'STATE' && pub.state.trim().length < 2)}
                    onClick={async () => {
                      try {
                        await clientApi.post(`/catalogue/cards/${c.id}/publications`, { channel: pub.channel, scope: pub.scope, pincode: pub.scope === 'PINCODE' ? pub.pincode : undefined, state: pub.scope === 'STATE' ? pub.state : undefined });
                        await reloadPubs();
                        setMsg('Publication added.');
                      } catch (e) {
                        fail(e, 'Could not add the publication.');
                      }
                    }}
                  >
                    <Plus />
                    Offer
                  </Button>
                </div>
              ) : null}
            </div>
          </SectionCard>
          <SectionCard icon={Rocket} tone="emerald" title="Publication" description="Publishing checks the copy for forbidden phrases (REQ-11 §11.3). Overrides need a reason and are audited.">
            <div className="grid gap-3">
              {forbidden.length ? (
                <Callout tone="danger" icon={ShieldAlert} role="alert">
                  <div className="grid gap-2">
                    <span>
                      Blocked phrases: <strong>{forbidden.join(', ')}</strong>. Remove them, or override:
                    </span>
                    <Input id="override" placeholder="override reason (audited)" value={override} onChange={(e) => setOverride(e.target.value)} />
                  </div>
                </Callout>
              ) : null}
              {c.forbiddenPhraseOverride ? <p className="text-xs text-slate-500">Published with override: {c.forbiddenPhraseOverride}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={readOnly || (forbidden.length > 0 && override.trim().length < 3)} onClick={publish}>
                  <Rocket />
                  {c.status === 'PUBLISHED' ? 'Publish new version' : 'Publish'}
                </Button>
                {c.status !== 'RETIRED' ? (
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      const reason = window.prompt('Reason for retiring this card?');
                      if (!reason) return;
                      try {
                        await clientApi.post(`/catalogue/cards/${c.id}/retire`, { reason });
                        await refresh();
                      } catch (e) {
                        fail(e, 'Could not retire.');
                      }
                    }}
                  >
                    <Archive />
                    Retire
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">Effective channels right now: {c.effectiveChannels.join(', ') || 'none'}.</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
