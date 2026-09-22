import { type AvailableCard, type CreatePublicationBody, NO_CARD_AVAILABLE_MESSAGE } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PincodeMasterService } from '../calling-list/pincode-master.service';

import { CatalogueService } from './catalogue.service';
import { PincodeProfileService } from './pincode-profile.service';

type Channel = 'TELECALLER' | 'ADVISOR';

/**
 * F-308: cards offered for a pincode = bank SOURCEABLE (approved profile, latest batch) ∩ card PUBLISHED ∩ publication covers
 * pincode/state/global for the channel ∩ an application link is effective now. "Sourceable ≠ offered ≠ qualifies" (REQ-07 §7.1).
 */
@Injectable()
export class CardAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: PincodeProfileService,
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
    const [sourceable, loc] = await Promise.all([this.profiles.sourceability(pincode), this.pincodes.lookup(pincode)]);
    const sourceableBanks = sourceable.filter((s) => s.sourceability === 'SOURCEABLE'); // REQUIRES_BANK_MAPPING never counts (PIN-02)
    const empty = { cards: [] as AvailableCard[], message: NO_CARD_AVAILABLE_MESSAGE, asOf: asOf.toISOString(), pincode, location: { state: loc.state, district: loc.district } };
    if (!sourceableBanks.length) return empty;

    const state = loc.state?.toUpperCase() ?? null;
    const pubs = await this.prisma.client.cardPincodePublication.findMany({
      where: {
        channel: { in: [channel, 'BOTH'] },
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
        AND: [{ OR: [{ pincode }, ...(state ? [{ state }] : []), { pincode: null, state: null }] }],
        card: { status: 'PUBLISHED', bankId: { in: sourceableBanks.map((b) => b.bankId) }, bank: { active: true } },
      },
      include: { card: { include: { bank: { select: { id: true, code: true, displayName: true } }, categories: { include: { category: { select: { key: true, label: true } } } } } } },
    });
    if (!pubs.length) return empty;

    // most specific publication per card wins (PINCODE > STATE > GLOBAL)
    const rank = (p: { pincode: string | null; state: string | null }) => (p.pincode ? 0 : p.state ? 1 : 2);
    const byCard = new Map<string, (typeof pubs)[number]>();
    for (const p of pubs) {
      const cur = byCard.get(p.cardId);
      if (!cur || rank(p) < rank(cur)) byCard.set(p.cardId, p);
    }
    const batchIds = [...new Set(sourceableBanks.map((b) => b.batchId))];
    const [batches, rawRows] = await Promise.all([
      this.prisma.client.bankPincodeBatch.findMany({ where: { id: { in: batchIds } }, select: { id: true, uploadedAt: true } }),
      this.prisma.client.bankPincodeRow.findMany({ where: { pincode, batchId: { in: batchIds }, sourceability: 'SOURCEABLE' }, select: { bankId: true, raw: true } }),
    ]);
    const uploadedAt = new Map(batches.map((b) => [b.id, b.uploadedAt]));
    const rawByBank = new Map(rawRows.map((r) => [r.bankId, r.raw as Record<string, string>]));

    const cards: AvailableCard[] = [];
    for (const p of byCard.values()) {
      const link = await this.catalogue.effectiveLink(p.cardId, channel, asOf);
      if (!link) continue; // no effective link for this channel → not offered
      const s = sourceableBanks.find((b) => b.bankId === p.card.bankId)!;
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
        provenance: { sourceability: s.sourceability, batchId: s.batchId, rawFlags: rawByBank.get(c.bankId) ?? {}, batchUploadedAt: uploadedAt.get(s.batchId)?.toISOString() ?? null, publication: { scope: p.pincode ? 'PINCODE' : p.state ? 'STATE' : 'GLOBAL', id: p.id } },
      });
    }
    cards.sort((a, b) => a.bank.displayName.localeCompare(b.bank.displayName) || a.name.localeCompare(b.name));
    return { ...empty, cards, message: cards.length ? null : NO_CARD_AVAILABLE_MESSAGE };
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
}
