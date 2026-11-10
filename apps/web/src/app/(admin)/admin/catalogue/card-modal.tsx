'use client';

import { ApiClientError, personaliseLink } from '@kbs/shared';
import { CreditCard, Pencil, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { FileUploadButton } from '@/components/file-upload-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, Field } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

interface CardDetail {
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
  image: { id: string; originalName: string } | null;
  benefitPdf: { id: string; originalName: string } | null;
  categories: { key: string }[];
  status: string;
  applyUrl: string | null;
  availability: { allIndia: boolean };
  pincodes: string[];
}

const blank = {
  name: '',
  productCode: '',
  categoryKeys: [] as string[],
  joiningFee: '',
  annualFee: '',
  benefits: '',
  majorCharges: '',
  description: '',
  eligibilityHighlights: '',
  disclosures: '',
  image: null as { id: string; originalName: string } | null,
  pdf: null as { id: string; originalName: string } | null,
  applyUrl: '',
  allIndia: true,
  pincodes: '',
  active: true,
};
type Form = typeof blank;

const lines = (t: string) =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
/** Any 6-digit run counts, so a column pasted from Excel, a CSV or a comma list all work. */
const parsePincodes = (t: string) => [...new Set(t.match(/\b\d{6}\b/g) ?? [])];
const money = (v: string) => (v.trim() === '' ? null : Number(v));
const textOrNull = (v: string) => (v.trim() === '' ? null : v.trim());

function fromDetail(c: CardDetail): Form {
  return {
    name: c.name,
    productCode: c.productCode ?? '',
    categoryKeys: c.categories.map((x) => x.key),
    joiningFee: c.joiningFee == null ? '' : String(c.joiningFee),
    annualFee: c.annualFee == null ? '' : String(c.annualFee),
    benefits: (c.benefits ?? []).join('\n'),
    majorCharges: (c.majorCharges ?? []).map((m) => `${m.label}: ${m.value}`).join('\n'),
    description: c.description ?? '',
    eligibilityHighlights: c.eligibilityHighlights ?? '',
    disclosures: c.disclosures ?? '',
    image: c.image,
    pdf: c.benefitPdf,
    applyUrl: c.applyUrl ?? '',
    allIndia: c.availability.allIndia || c.pincodes.length === 0,
    pincodes: c.pincodes.join(', '),
    active: c.status === 'PUBLISHED',
  };
}

/**
 * Catalogue rewrite: one modal creates or edits a card with everything an Advisor/Telecaller needs — details, files, the
 * apply link (with `{code}` for the sharer's own code) and where it is offered (all India or a pincode list).
 */
function CardModal({
  cardId,
  categories,
  onClose,
}: {
  cardId: string | null;
  categories: { key: string; label: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState<Form>(blank);
  const [loading, setLoading] = useState(Boolean(cardId));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    ref.current?.showModal();
    if (!cardId) return;
    clientApi
      .get<CardDetail>(`/catalogue/cards/${cardId}`)
      .then((r) => setF(fromDetail(r.data)))
      .catch((e) => setMsg(e instanceof ApiClientError ? e.message : 'Could not load the card.'))
      .finally(() => setLoading(false));
  }, [cardId]);

  const pins = parsePincodes(f.pincodes);
  const hasCode = /\{code\}/i.test(f.applyUrl);

  async function save() {
    if (!f.allIndia && pins.length === 0)
      return setMsg('Choose “All India” or add at least one 6-digit pincode.');
    if (f.applyUrl.trim() === '') return setMsg('Add the apply link.');
    const charges = lines(f.majorCharges).map((l) => {
      const i = l.indexOf(':');
      return i > 0
        ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() }
        : { label: l, value: '—' };
    });
    const body = {
      name: f.name.trim(),
      productCode: textOrNull(f.productCode),
      categoryKeys: f.categoryKeys,
      joiningFee: money(f.joiningFee),
      annualFee: money(f.annualFee),
      benefits: lines(f.benefits),
      majorCharges: charges,
      description: textOrNull(f.description),
      eligibilityHighlights: textOrNull(f.eligibilityHighlights),
      disclosures: textOrNull(f.disclosures),
      imageFileId: f.image?.id ?? null,
      benefitPdfFileId: f.pdf?.id ?? null,
      applyUrl: f.applyUrl.trim(),
      availability: f.allIndia ? 'ALL_INDIA' : pins,
      active: f.active,
    };
    setBusy(true);
    setMsg(null);
    try {
      if (cardId) await clientApi.patch(`/catalogue/cards/${cardId}`, body);
      else await clientApi.post('/catalogue/cards', body); // cards are bank-independent
      ref.current?.close();
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Could not save the card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label={cardId ? 'Edit card' : 'Create card'}
      className="fixed top-1/2 left-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden glass-strong rounded-2xl p-0 text-foreground backdrop:bg-black/45 open:flex open:flex-col"
      onClose={onClose}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-surface-muted ring-1 ring-border">
            <CreditCard className="size-4.5" aria-hidden="true" />
          </span>
          <p className="text-[15px] font-semibold">{cardId ? 'Edit card' : 'Create card'}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          className="rounded-lg p-1.5 text-fg-3 hover:bg-muted hover:text-fg-2"
          onClick={() => ref.current?.close()}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading card…</p>
      ) : (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <Field label="Card name" htmlFor="cm-name">
                <Input
                  id="cm-name"
                  required
                  minLength={2}
                  value={f.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </Field>
              <Field label="Joining fee (₹)" htmlFor="cm-jf">
                <Input
                  id="cm-jf"
                  inputMode="decimal"
                  value={f.joiningFee}
                  onChange={(e) => set('joiningFee', e.target.value.replace(/[^\d.]/g, ''))}
                />
              </Field>
              <Field label="Annual fee (₹)" htmlFor="cm-af">
                <Input
                  id="cm-af"
                  inputMode="decimal"
                  value={f.annualFee}
                  onChange={(e) => set('annualFee', e.target.value.replace(/[^\d.]/g, ''))}
                />
              </Field>
              <Field label="Product code (as in the bank MIS)" htmlFor="cm-pc" hint="Optional.">
                <Input
                  id="cm-pc"
                  value={f.productCode}
                  onChange={(e) => set('productCode', e.target.value)}
                />
              </Field>
              <Field label="Categories">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => {
                    const on = f.categoryKeys.includes(c.key);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          set(
                            'categoryKeys',
                            on
                              ? f.categoryKeys.filter((k) => k !== c.key)
                              : [...f.categoryKeys, c.key],
                          )
                        }
                        className={cn(
                          'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                          on
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border text-fg-2 hover:text-foreground',
                        )}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </section>

            <section className="grid gap-3 border-t border-border-subtle pt-5">
              <Field
                label="Apply link"
                htmlFor="cm-url"
                hint="Put {code} where the bank expects the agent code — it is replaced by the code of whoever shares the link."
              >
                <Input
                  id="cm-url"
                  type="url"
                  required
                  placeholder="https://bank.example/apply?utm_source=KBS&agent={code}"
                  value={f.applyUrl}
                  onChange={(e) => set('applyUrl', e.target.value)}
                />
              </Field>
              {f.applyUrl.trim() ? (
                hasCode ? (
                  <p className="rounded-xl bg-surface-muted px-3 py-2 font-mono text-2xs break-all text-fg-2">
                    e.g. an FOS with code AB12CD34 shares:{' '}
                    {personaliseLink(f.applyUrl.trim(), 'AB12CD34')}
                  </p>
                ) : (
                  <Callout tone="warning">
                    No {'{code}'} in the link — it will be shared without the agent’s code.
                  </Callout>
                )
              ) : null}
            </section>

            <section className="grid gap-3 border-t border-border-subtle pt-5">
              <p className="text-sm font-semibold">Where is this card available?</p>
              <div role="radiogroup" aria-label="Availability" className="flex flex-wrap gap-2">
                {[
                  [true, 'All India'],
                  [false, 'Only these pincodes'],
                ].map(([v, label]) => (
                  <button
                    key={String(v)}
                    type="button"
                    role="radio"
                    aria-checked={f.allIndia === v}
                    onClick={() => set('allIndia', v as boolean)}
                    className={cn(
                      'rounded-md border px-4 py-1.5 text-sm font-medium',
                      f.allIndia === v
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-fg-2 hover:text-foreground',
                    )}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
              {f.allIndia ? null : (
                <>
                  <Field
                    label="Pincodes"
                    htmlFor="cm-pins"
                    hint="Paste a column from Excel, or type them separated by commas, spaces or new lines."
                  >
                    <textarea
                      id="cm-pins"
                      rows={4}
                      className="w-full rounded-2xl border border-input bg-card px-4 py-2.5 font-mono text-sm"
                      value={f.pincodes}
                      onChange={(e) => set('pincodes', e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {pins.length.toLocaleString('en-IN')} pincode{pins.length === 1 ? '' : 's'}
                    </span>
                    <label className="cursor-pointer text-xs font-medium text-fg-2 underline-offset-2 hover:underline">
                      Add from a .csv / .txt file
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) set('pincodes', `${f.pincodes}\n${await file.text()}`);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </>
              )}
            </section>

            <section className="grid gap-3 border-t border-border-subtle pt-5 sm:grid-cols-2">
              <Field
                label="Benefits"
                htmlFor="cm-ben"
                hint="One per line."
                className="sm:col-span-2"
              >
                <textarea
                  id="cm-ben"
                  rows={3}
                  className="w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm"
                  value={f.benefits}
                  onChange={(e) => set('benefits', e.target.value)}
                />
              </Field>
              <Field label="Description" htmlFor="cm-desc" className="sm:col-span-2">
                <textarea
                  id="cm-desc"
                  rows={2}
                  className="w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm"
                  value={f.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
              <Field label="Major charges" htmlFor="cm-ch" hint="One per line, “Label: value”.">
                <textarea
                  id="cm-ch"
                  rows={3}
                  className="w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm"
                  value={f.majorCharges}
                  onChange={(e) => set('majorCharges', e.target.value)}
                />
              </Field>
              <Field label="Eligibility highlights" htmlFor="cm-el">
                <textarea
                  id="cm-el"
                  rows={3}
                  className="w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm"
                  value={f.eligibilityHighlights}
                  onChange={(e) => set('eligibilityHighlights', e.target.value)}
                />
              </Field>
              <Field label="Disclosures" htmlFor="cm-dis" className="sm:col-span-2">
                <textarea
                  id="cm-dis"
                  rows={2}
                  className="w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm"
                  value={f.disclosures}
                  onChange={(e) => set('disclosures', e.target.value)}
                />
              </Field>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-fg-2">Card image</span>
                <div className="flex flex-wrap items-center gap-2">
                  <FileUploadButton
                    purpose="card_image"
                    accept="image/*"
                    label={f.image ? 'Replace image' : 'Upload image'}
                    onUploaded={(x) => set('image', x)}
                  />
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {f.image?.originalName ?? 'None'}
                  </span>
                </div>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-fg-2">Benefit PDF</span>
                <div className="flex flex-wrap items-center gap-2">
                  <FileUploadButton
                    purpose="benefit_pdf"
                    accept="application/pdf"
                    label={f.pdf ? 'Replace PDF' : 'Upload PDF'}
                    onUploaded={(x) => set('pdf', x)}
                  />
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {f.pdf?.originalName ?? 'None'}
                  </span>
                </div>
              </div>
            </section>

            <label className="flex items-center gap-3 border-t border-border-subtle pt-5 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-foreground"
                checked={f.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              <span>
                <span className="font-medium">Active</span>
                <span className="block text-xs text-muted-foreground">
                  Active cards are offered to FOS agents and callers; inactive ones are hidden.
                </span>
              </span>
            </label>

            {msg ? (
              <p
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
              >
                {msg}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border-subtle px-5 py-3">
            <Button type="button" variant="outline" onClick={() => ref.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : cardId ? 'Save card' : 'Create card'}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/** Opens the modal for a new card (`cardId` omitted) or an existing one. Mounted only while open, so each opening starts fresh. */
export function CardModalButton({
  cardId,
  categories,
}: {
  cardId?: string;
  categories: { key: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {cardId ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Pencil />
          Edit
        </Button>
      ) : (
        <Button type="button" size="sm" className="h-9 shrink-0" onClick={() => setOpen(true)}>
          <Plus />
          Create card
        </Button>
      )}
      {open ? (
        <CardModal cardId={cardId ?? null} categories={categories} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
