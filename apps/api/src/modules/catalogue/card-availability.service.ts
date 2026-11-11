import { type AvailableCard, type BrowseCard, type BrowseCardsQuery, type CreatePublicationBody, NO_CARD_AVAILABLE_MESSAGE } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PincodeMasterService } from '../calling-list/pincode-master.service';

import { CatalogueService } from './catalogue.service';

type Channel = 'TELECALLER' | 'ADVISOR';

/**
 * F-308: cards offered for a pincode = card PUBLISHED ∩ the card's own availability (publication) covers the pincode, its state
 * or all India for the channel ∩ an application link is effective now. Availability is set per card in the catalogue modal;
 * bank coverage sheets no longer gate it (user decision, catalogue rewrite).
 */
@Injectable()
export class CardAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: CatalogueService,
    private readonly pincodes: PincodeMasterService,
  ) {}

  // ── publications (Admin) ──
  async addPublication(actor: Actor, cardId: string, body: CreatePublicationBody) {
    const card = await this.prisma.client.creditCard.findUnique({ where: { id: cardId } });
    if (!card) throw AppError.notFound('Card');
    if (card.status === 'RETIRED') throw new AppError('CONFLICT', 'Retired cards cannot be published to pincodes.');
    const p = await this.prisma.client.cardPincodePublication.create({
      data: { cardId, channel: body.channel, pincode: body.scope === 'PINCODE' ? body.pincode : null, state: body.scope === 'STATE' ? body.state?.toUpperCase() : null, publishedByUserId: actor.userId, effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null },
    });
    RequestContextStore.audit({ entityId: p.id, after: { cardId, ...body } });
    return p;
  }

  async endPublication(id: string, reason: string) {
    const p = await this.prisma.client.cardPincodePublication.findUnique({ where: { id } });
    if (!p) throw AppError.notFound('Publication');
    const u = await this.prisma.client.cardPincodePublication.update({ where: { id }, data: { effectiveTo: new Date() } });
    RequestContextStore.audit({ entityId: id, before: { effectiveTo: p.effectiveTo }, after: { effectiveTo: u.effectiveTo }, reason });
    return u;
  }

  listPublications(cardId: string) {
    return this.prisma.client.cardPincodePublication.findMany({ where: { cardId }, orderBy: { effectiveFrom: 'desc' } });
  }

  // ── availability ──
  async available(pincode: string, channel: Channel): Promise<{ cards: AvailableCard[]; message: string | null; asOf: string; pincode: string; location: { state: string | null; district: string | null } }> {
    const asOf = new Date();
    const loc = await this.pincodes.lookup(pincode);
    const empty = { cards: [] as AvailableCard[], message: NO_CARD_AVAILABLE_MESSAGE, asOf: asOf.toISOString(), pincode, location: { state: loc.state, district: loc.district } };
    const byCard = await this.publicationsAt(pincode, loc.state, channel, asOf);
    if (!byCard.size) return empty;

    const cards: AvailableCard[] = [];
    for (const p of byCard.values()) {
      const link = await this.catalogue.effectiveLink(p.cardId, channel, asOf);
      if (!link) continue; // no effective link for this channel → not offered
      const c = p.card;
      cards.push({
        id: c.id,
        name: c.name,
        version: c.version,
        bank: c.bank,
        categories: c.categories.map((x) => x.category),
        description: c.description,
        benefits: (c.benefits as string[] | null) ?? [],
        joiningFee: c.joiningFee === null ? null : Number(c.joiningFee),
        annualFee: c.annualFee === null ? null : Number(c.annualFee),
        majorCharges: (c.majorCharges as { label: string; value: string }[] | null) ?? [],
        eligibilityHighlights: c.eligibilityHighlights,
        disclosures: c.disclosures,
        imageFileId: c.imageFileId,
        benefitPdfFileId: c.benefitPdfFileId,
        link: { id: link.id, version: link.version, channel: link.channel },
        provenance: { publication: { scope: p.pincode ? 'PINCODE' : p.state ? 'STATE' : 'GLOBAL', id: p.id } },
      });
    }
    cards.sort((a, b) => a.bank.displayName.localeCompare(b.bank.displayName) || a.name.localeCompare(b.name));
    return { ...empty, cards, message: cards.length ? null : NO_CARD_AVAILABLE_MESSAGE };
  }

  /** Open publications covering a pincode (or its state, or all India) for PUBLISHED cards of active banks; most specific per card wins. */
  private async publicationsAt(pincode: string, state: string | null, channel: Channel, asOf: Date) {
    const st = state?.toUpperCase() ?? null;
    const pubs = await this.prisma.client.cardPincodePublication.findMany({
      where: {
        channel: { in: [channel, 'BOTH'] },
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
        AND: [{ OR: [{ pincode }, ...(st ? [{ state: st }] : []), { pincode: null, state: null }] }],
        card: { status: 'PUBLISHED', bank: { active: true } },
      },
      include: { card: { include: { bank: { select: { id: true, code: true, displayName: true } }, categories: { include: { category: { select: { key: true, label: true } } } } } } },
    });
    // PINCODE > STATE > GLOBAL
    const rank = (p: { pincode: string | null; state: string | null }) => (p.pincode ? 0 : p.state ? 1 : 2);
    const byCard = new Map<string, (typeof pubs)[number]>();
    for (const p of pubs) {
      const cur = byCard.get(p.cardId);
      if (!cur || rank(p) < rank(cur)) byCard.set(p.cardId, p);
    }
    return byCard;
  }

  /** REQ-11 §11.7: is this one card offered at the pincode? The same publication check as `browse?pincode` / `available`. */
  async isAvailableAt(cardId: string, pincode: string, channel: Channel): Promise<boolean> {
    const loc = await this.pincodes.lookup(pincode);
    return (await this.publicationsAt(pincode, loc.state, channel, new Date())).has(cardId);
  }

  /** Cards for a calling record (Telecaller own / Manager team / Admin), using the record's stored pincode. */
  async forCallingRecord(actor: Actor, recordId: string) {
    const r = await this.prisma.client.callingRecord.findUnique({ where: { id: recordId }, select: { id: true, pincode: true, assignedTelecallerUserId: true } });
    if (!r) throw AppError.notFound('Record');
    const allowed = actor.role === 'ADMIN' || (actor.role === 'MANAGER' && r.assignedTelecallerUserId !== null && actor.teamUserIds.includes(r.assignedTelecallerUserId)) || (actor.role === 'TELECALLER' && r.assignedTelecallerUserId === actor.userId);
    if (!allowed) throw AppError.notFound('Record');
    if (!/^\d{6}$/.test(r.pincode) || r.pincode === '000000') return { cards: [], message: NO_CARD_AVAILABLE_MESSAGE, asOf: new Date().toISOString(), pincode: r.pincode, location: { state: null, district: null } };
    return this.available(r.pincode, 'TELECALLER');
  }

  /**
   * F-405: Advisor catalogue browse — PUBLISHED cards with an effective ADVISOR link, filtered by category/bank/text.
   * With `pincode`, each card is annotated from the bank's uploaded data (never hidden: Advisors see why a card is unavailable).
   */
  async browse(q: BrowseCardsQuery): Promise<{ cards: BrowseCard[]; pincode: string | null; asOf: string }> {
    const asOf = new Date();
    const cards = await this.prisma.client.creditCard.findMany({
      where: {
        status: 'PUBLISHED',
        bank: { active: true },
        ...(q.bankId ? { bankId: q.bankId } : {}),
        ...(q.category ? { categories: { some: { category: { key: q.category } } } } : {}),
        ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { bank: { displayName: { contains: q.q, mode: 'insensitive' } } }, { description: { contains: q.q, mode: 'insensitive' } }] } : {}),
      },
      include: { bank: { select: { id: true, code: true, displayName: true } }, categories: { include: { category: { select: { key: true, label: true } } } } },
    });
    // with a pincode the list is only the cards available there (user decision: FOS search by pincode)
    const here = q.pincode ? await this.publicationsAt(q.pincode, (await this.pincodes.lookup(q.pincode)).state, 'ADVISOR', asOf) : null;
    const out: BrowseCard[] = [];
    for (const c of cards) {
      if (here && !here.has(c.id)) continue;
      const link = await this.catalogue.effectiveLink(c.id, 'ADVISOR', asOf);
      if (!link) continue;
      out.push({
        id: c.id,
        name: c.name,
        version: c.version,
        bank: c.bank,
        categories: c.categories.map((x) => x.category),
        description: c.description,
        benefits: (c.benefits as string[] | null) ?? [],
        joiningFee: c.joiningFee === null ? null : Number(c.joiningFee),
        annualFee: c.annualFee === null ? null : Number(c.annualFee),
        majorCharges: (c.majorCharges as { label: string; value: string }[] | null) ?? [],
        eligibilityHighlights: c.eligibilityHighlights,
        disclosures: c.disclosures,
        imageFileId: c.imageFileId,
        benefitPdfFileId: c.benefitPdfFileId,
        link: { id: link.id, version: link.version, channel: link.channel },
        sourceableAtPincode: here ? true : null,
        sourceabilityProvenance: null,
      });
    }
    const key = q.sort;
    out.sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name) : key === 'joiningFee' || key === 'annualFee' ? (a[key] ?? Infinity) - (b[key] ?? Infinity) : a.bank.displayName.localeCompare(b.bank.displayName) || a.name.localeCompare(b.name)));
    return { cards: out, pincode: q.pincode ?? null, asOf: asOf.toISOString() };
  }
}
