'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

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
  const field = (key: keyof typeof form, label: string, textarea = false) => (
    <div className="grid gap-1">
      <Label htmlFor={`f-${key}`}>{label}</Label>
      {textarea ? (
        <textarea id={`f-${key}`} disabled={readOnly} className="border-input bg-background min-h-20 rounded-md border p-2 text-sm" value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      ) : (
        <Input id={`f-${key}`} disabled={readOnly} value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      )}
    </div>
  );
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{c.name}</h1>
        <Badge variant={c.status === 'PUBLISHED' ? 'success' : c.status === 'DRAFT' ? 'info' : 'unknown'}>
          {c.status} v{c.version}
        </Badge>
        <span className="text-muted-foreground text-sm">{c.bank.displayName}</span>
      </div>
      {msg ? (
        <p role="status" className="rounded-md border p-3 text-sm">
          {msg}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basics, benefits & fees</CardTitle>
            <CardDescription>REQ-07 §7.1 fields. One benefit per line; charges as “label: value”.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {field('name', 'Card name')}
            {field('productCode', 'Bank product code (for MIS crosswalk)')}
            {field('description', 'Description', true)}
            {field('benefits', 'Rewards / benefits (one per line)', true)}
            <div className="grid grid-cols-2 gap-2">
              {field('joiningFee', 'Joining fee (₹)')}
              {field('annualFee', 'Annual fee (₹)')}
            </div>
            {field('majorCharges', 'Major charges (label: value per line)', true)}
            {field('eligibilityHighlights', 'Eligibility highlights', true)}
            {field('disclosures', 'Disclosures', true)}
            <div className="grid gap-1">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-3">
                {categories.map((cat) => (
                  <label key={cat.key} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" disabled={readOnly} checked={form.categoryKeys.includes(cat.key)} onChange={(e) => setForm({ ...form, categoryKeys: e.target.checked ? [...form.categoryKeys, cat.key] : form.categoryKeys.filter((k) => k !== cat.key) })} />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Button disabled={readOnly} onClick={save}>
                Save details
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
              <CardDescription>Card image and benefit PDF (files module).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span>Image: {c.image?.originalName ?? '—'}</span>
                <FileUploadButton
                  purpose="card_image"
                  accept="image/*"
                  label="Upload image"
                  onUploaded={async (f) => {
                    await clientApi.patch(`/catalogue/cards/${c.id}`, { imageFileId: f.id });
                    await refresh();
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span>Benefit PDF: {c.benefitPdf?.originalName ?? '—'}</span>
                <FileUploadButton
                  purpose="benefit_pdf"
                  accept="application/pdf"
                  label="Upload PDF"
                  onUploaded={async (f) => {
                    await clientApi.patch(`/catalogue/cards/${c.id}`, { benefitPdfFileId: f.id });
                    await refresh();
                  }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Application links</CardTitle>
              <CardDescription>Stored exactly as pasted (tracking strings and fragments preserved). One effective link per channel; adding a new one closes the previous.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ul className="grid gap-1 text-xs">
                {c.links.map((l) => {
                  const live = l.live;
                  return (
                    <li key={l.id} className="flex flex-wrap items-center gap-2 border-b py-1">
                      <Badge variant={live ? 'success' : 'unknown'}>
                        {l.channel} v{l.version}
                      </Badge>
                      <span className="font-mono break-all">{l.url}</span>
                      <span className="text-muted-foreground">
                        {formatDateTime(l.effectiveFrom)} → {l.effectiveTo ? formatDateTime(l.effectiveTo) : 'open'}
                      </span>
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
                    </li>
                  );
                })}
                {c.links.length === 0 ? <li className="text-muted-foreground">No links yet — the card cannot be offered until one is effective.</li> : null}
              </ul>
              {!readOnly ? (
                <div className="grid gap-2 md:grid-cols-[8rem_1fr_auto]">
                  <select aria-label="channel" className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={link.channel} onChange={(e) => setLink({ ...link, channel: e.target.value })}>
                    <option value="BOTH">BOTH</option>
                    <option value="TELECALLER">TELECALLER</option>
                    <option value="ADVISOR">ADVISOR</option>
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
                    Add link
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Where this card is offered (F-308)</CardTitle>
              <CardDescription>A published card is offered for a customer pincode only when the bank is sourceable there AND a publication covers it: globally, by state (via pincode master), or by exact pincode.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ul className="grid gap-1 text-xs">
                {pubs.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2 border-b py-1">
                    <Badge variant={x.effectiveTo && new Date(x.effectiveTo) <= new Date(x.effectiveFrom) ? 'unknown' : x.effectiveTo ? 'warning' : 'success'}>{x.channel}</Badge>
                    <span>{x.pincode ? `pincode ${x.pincode}` : x.state ? `state ${x.state}` : 'global'}</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(x.effectiveFrom)} → {x.effectiveTo ? formatDateTime(x.effectiveTo) : 'open'}
                    </span>
                    {!x.effectiveTo ? (
                      <Button
                        size="sm"
                        variant="ghost"
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
                {pubs.length === 0 ? <li className="text-muted-foreground">Not offered anywhere yet.</li> : null}
              </ul>
              {!readOnly ? (
                <div className="grid gap-2 md:grid-cols-[7rem_7rem_1fr_auto]">
                  <select aria-label="publication channel" className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={pub.channel} onChange={(e) => setPub({ ...pub, channel: e.target.value })}>
                    <option value="BOTH">BOTH</option>
                    <option value="TELECALLER">TELECALLER</option>
                    <option value="ADVISOR">ADVISOR</option>
                  </select>
                  <select aria-label="publication scope" className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={pub.scope} onChange={(e) => setPub({ ...pub, scope: e.target.value })}>
                    <option value="GLOBAL">Global</option>
                    <option value="STATE">State</option>
                    <option value="PINCODE">Pincode</option>
                  </select>
                  {pub.scope === 'PINCODE' ? <Input id="pub-pincode" placeholder="302001" value={pub.pincode} onChange={(e) => setPub({ ...pub, pincode: e.target.value })} /> : pub.scope === 'STATE' ? <Input id="pub-state" placeholder="Rajasthan" value={pub.state} onChange={(e) => setPub({ ...pub, state: e.target.value })} /> : <span />}
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
                    Offer
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Publication</CardTitle>
              <CardDescription>Publishing checks the copy for forbidden phrases (REQ-11 §11.3). Overrides need a reason and are audited.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {forbidden.length ? (
                <div className="grid gap-1 rounded-md border border-destructive p-2 text-sm">
                  <span>
                    Blocked phrases: <strong>{forbidden.join(', ')}</strong>. Remove them, or override:
                  </span>
                  <Input id="override" placeholder="override reason (audited)" value={override} onChange={(e) => setOverride(e.target.value)} />
                </div>
              ) : null}
              {c.forbiddenPhraseOverride ? <p className="text-muted-foreground text-xs">Published with override: {c.forbiddenPhraseOverride}</p> : null}
              <div className="flex gap-2">
                <Button disabled={readOnly || (forbidden.length > 0 && override.trim().length < 3)} onClick={publish}>
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
                    Retire
                  </Button>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">Effective channels right now: {c.effectiveChannels.join(', ') || 'none'}.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
