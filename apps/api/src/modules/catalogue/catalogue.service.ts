import { type CardBody, type CreateBankBody, type CreateCrosswalkBody, type CreateLinkBody, type PublishCardBody, type UpdateBankBody, type UpdateCardBody } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';

type Channel = 'TELECALLER' | 'ADVISOR' | 'BOTH';

/** F-403: banks, categories, credit cards (DRAFT → PUBLISHED → RETIRED), verbatim application links, MIS product-code crosswalk. */
@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── banks ──
  listBanks(includeInactive = false) {
    return this.prisma.client.bank.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { displayName: 'asc' }, include: { _count: { select: { cards: true } } } });
  }

  async createBank(body: CreateBankBody) {
    if (await this.prisma.client.bank.findUnique({ where: { code: body.code } })) throw new AppError('CONFLICT', `Bank code ${body.code} already exists.`);
    const b = await this.prisma.client.bank.create({ data: body });
    RequestContextStore.audit({ entityId: b.id, after: body });
    return b;
  }

  async updateBank(id: string, body: UpdateBankBody) {
    const before = await this.prisma.client.bank.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Bank');
    const b = await this.prisma.client.bank.update({ where: { id }, data: body });
    RequestContextStore.audit({ entityId: id, before: { displayName: before.displayName, active: before.active }, after: body });
    return b;
  }

  listCategories() {
    return this.prisma.client.cardCategory.findMany({ where: { active: true }, orderBy: { sequence: 'asc' } });
  }

  // ── cards ──
  private cardInclude = {
    bank: { select: { id: true, code: true, displayName: true } },
    categories: { include: { category: { select: { key: true, label: true } } } },
    image: { select: { id: true, originalName: true } },
    benefitPdf: { select: { id: true, originalName: true } },
    links: { orderBy: [{ channel: 'asc' as const }, { version: 'desc' as const }] },
  };

  private toDto<T extends { categories: Array<{ category: { key: string; label: string } }>; links: Array<{ effectiveFrom: Date; effectiveTo: Date | null; channel: Channel }>; joiningFee: unknown; annualFee: unknown }>(c: T) {
    const now = Date.now();
    const isLive = (l: { effectiveFrom: Date; effectiveTo: Date | null }) => l.effectiveFrom.getTime() <= now && (!l.effectiveTo || l.effectiveTo.getTime() > now);
    const effectiveLinks = c.links.filter(isLive);
    return {
      ...c,
      links: c.links.map((l) => ({ ...l, live: isLive(l) })),
      joiningFee: c.joiningFee === null ? null : Number(c.joiningFee),
      annualFee: c.annualFee === null ? null : Number(c.annualFee),
      categories: c.categories.map((x) => x.category),
      effectiveChannels: [...new Set(effectiveLinks.flatMap((l) => (l.channel === 'BOTH' ? ['TELECALLER', 'ADVISOR'] : [l.channel])))],
    };
  }

  async listCards(filter: { status?: 'DRAFT' | 'PUBLISHED' | 'RETIRED'; bankId?: string }) {
    const rows = await this.prisma.client.creditCard.findMany({ where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.bankId ? { bankId: filter.bankId } : {}) }, orderBy: [{ bank: { displayName: 'asc' } }, { name: 'asc' }], include: this.cardInclude });
    return rows.map((c) => this.toDto(c));
  }

  async getCard(id: string) {
    const c = await this.prisma.client.creditCard.findUnique({ where: { id }, include: this.cardInclude });
    if (!c) throw AppError.notFound('Card');
    return this.toDto(c);
  }

  private async categoryIds(keys: string[] | undefined) {
    if (!keys) return undefined;
    const cats = await this.prisma.client.cardCategory.findMany({ where: { key: { in: keys } } });
    const missing = keys.filter((k) => !cats.some((c) => c.key === k));
    if (missing.length) throw new AppError('VALIDATION_FAILED', `Unknown categories: ${missing.join(', ')}`);
    return cats.map((c) => c.id);
  }

  private async assertFile(id: string | null | undefined, purpose: 'CARD_IMAGE' | 'BENEFIT_PDF') {
    if (!id) return;
    const f = await this.prisma.client.storedFile.findUnique({ where: { id }, select: { purpose: true } });
    if (!f || f.purpose !== purpose) throw new AppError('VALIDATION_FAILED', `File must be uploaded with purpose ${purpose}.`);
  }

  async createCard(body: CardBody) {
    const bank = await this.prisma.client.bank.findUnique({ where: { id: body.bankId } });
    if (!bank) throw AppError.notFound('Bank');
    await Promise.all([this.assertFile(body.imageFileId, 'CARD_IMAGE'), this.assertFile(body.benefitPdfFileId, 'BENEFIT_PDF')]);
    const catIds = await this.categoryIds(body.categoryKeys);
    const { categoryKeys: _k, ...data } = body;
    void _k;
    const c = await this.prisma.client.creditCard.create({ data: { ...data, benefits: data.benefits ?? [], majorCharges: data.majorCharges ?? [], categories: catIds ? { create: catIds.map((categoryId) => ({ categoryId })) } : undefined } });
    RequestContextStore.audit({ entityId: c.id, after: { name: c.name, bankId: c.bankId } });
    return this.getCard(c.id);
  }

  async updateCard(id: string, body: UpdateCardBody) {
    const before = await this.prisma.client.creditCard.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Card');
    if (before.status === 'RETIRED') throw new AppError('CONFLICT', 'Retired cards are read-only.');
    await Promise.all([this.assertFile(body.imageFileId, 'CARD_IMAGE'), this.assertFile(body.benefitPdfFileId, 'BENEFIT_PDF')]);
    const catIds = await this.categoryIds(body.categoryKeys);
    const { categoryKeys: _k, ...data } = body;
    void _k;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.creditCard.update({ where: { id }, data });
      if (catIds) {
        await tx.creditCardCategory.deleteMany({ where: { cardId: id } });
        await tx.creditCardCategory.createMany({ data: catIds.map((categoryId) => ({ cardId: id, categoryId })) });
      }
    });
    RequestContextStore.audit({ entityId: id, before: { name: before.name, status: before.status, version: before.version }, after: body });
    return this.getCard(id);
  }

  /** REQ-11 §11.3: marketing copy must not promise approval. Returns the offending phrases. */
  forbiddenPhrases(card: { name: string; description: string | null; benefits: unknown; eligibilityHighlights: string | null; disclosures: string | null }): string[] {
    const list = (this.config.getJson<string[]>('catalogue.forbiddenPhrases') ?? []).map((p) => p.toLowerCase());
    const text = [card.name, card.description ?? '', JSON.stringify(card.benefits ?? []), card.eligibilityHighlights ?? '', card.disclosures ?? ''].join(' \n ').toLowerCase();
    return list.filter((p) => text.includes(p));
  }

  async publishCard(actor: Actor, id: string, body: PublishCardBody) {
    const c = await this.prisma.client.creditCard.findUnique({ where: { id } });
    if (!c) throw AppError.notFound('Card');
    if (c.status === 'RETIRED') throw new AppError('CONFLICT', 'Retired cards cannot be published.');
    const hits = this.forbiddenPhrases(c);
    if (hits.length && !body.overrideReason) {
      throw new AppError('VALIDATION_FAILED', `Copy contains forbidden phrases (${hits.join(', ')}). Remove them or publish with an explicit override reason.`, { forbiddenPhrases: hits });
    }
    const updated = await this.prisma.client.creditCard.update({
      where: { id },
      data: { status: 'PUBLISHED', version: c.status === 'PUBLISHED' ? c.version + 1 : c.version, forbiddenPhraseOverride: hits.length ? `${actor.userId}: ${body.overrideReason}` : null },
    });
    RequestContextStore.audit({ entityId: id, before: { status: c.status, version: c.version }, after: { status: 'PUBLISHED', version: updated.version, forbiddenPhrases: hits }, reason: body.overrideReason });
    return this.getCard(id);
  }

  async retireCard(id: string, reason: string) {
    const c = await this.prisma.client.creditCard.findUnique({ where: { id } });
    if (!c) throw AppError.notFound('Card');
    await this.prisma.client.creditCard.update({ where: { id }, data: { status: 'RETIRED' } });
    RequestContextStore.audit({ entityId: id, before: { status: c.status }, after: { status: 'RETIRED' }, reason });
    return this.getCard(id);
  }

  // ── application links (verbatim; one effective link per card+channel) ──
  async addLink(actor: Actor, cardId: string, body: CreateLinkBody) {
    const c = await this.prisma.client.creditCard.findUnique({ where: { id: cardId } });
    if (!c) throw AppError.notFound('Card');
    const from = body.effectiveFrom ? new Date(body.effectiveFrom) : new Date();
    const to = body.effectiveTo ? new Date(body.effectiveTo) : null;
    if (to && to <= from) throw new AppError('VALIDATION_FAILED', 'effectiveTo must be after effectiveFrom.');
    const overlapping = (['TELECALLER', 'ADVISOR', 'BOTH'] as Channel[]).filter((ch) => ch === body.channel || ch === 'BOTH' || body.channel === 'BOTH');
    const prev = await this.prisma.client.applicationLink.findMany({ where: { cardId, channel: { in: overlapping }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] } });
    const version = (await this.prisma.client.applicationLink.count({ where: { cardId, channel: body.channel } })) + 1;
    const link = await this.prisma.client.$transaction(async (tx) => {
      // close any still-open overlapping link at the new link's start so exactly one is effective per channel
      for (const p of prev) if (!p.effectiveTo || p.effectiveTo > from) await tx.applicationLink.update({ where: { id: p.id }, data: { effectiveTo: from } });
      return tx.applicationLink.create({ data: { cardId, channel: body.channel, url: body.url, version, effectiveFrom: from, effectiveTo: to, createdByUserId: actor.userId } });
    });
    RequestContextStore.audit({ entityId: link.id, after: { cardId, channel: body.channel, url: body.url, version, closedPrevious: prev.map((p) => p.id) } });
    return link;
  }

  async endLink(id: string, reason: string) {
    const l = await this.prisma.client.applicationLink.findUnique({ where: { id } });
    if (!l) throw AppError.notFound('Link');
    if (l.effectiveTo && l.effectiveTo <= new Date()) throw new AppError('CONFLICT', 'Link already ended.');
    const u = await this.prisma.client.applicationLink.update({ where: { id }, data: { effectiveTo: new Date() } });
    RequestContextStore.audit({ entityId: id, before: { effectiveTo: l.effectiveTo }, after: { effectiveTo: u.effectiveTo }, reason });
    return u;
  }

  /** The link an Advisor/Telecaller must use right now for a card on a channel (F-308/F-405). */
  async effectiveLink(cardId: string, channel: 'TELECALLER' | 'ADVISOR', at = new Date()) {
    return this.prisma.client.applicationLink.findFirst({
      where: { cardId, channel: { in: [channel, 'BOTH'] }, effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
      orderBy: [{ channel: 'asc' }, { effectiveFrom: 'desc' }], // enum order TELECALLER, ADVISOR, BOTH → channel-specific link wins over BOTH
    });
  }

  // ── crosswalk ──
  listCrosswalks(bankId?: string) {
    return this.prisma.client.productCodeCrosswalk.findMany({ where: bankId ? { bankId } : {}, include: { bank: { select: { code: true } }, card: { select: { id: true, name: true, status: true } } }, orderBy: [{ bank: { code: 'asc' } }, { misProductCode: 'asc' }] });
  }

  async upsertCrosswalk(actor: Actor, body: CreateCrosswalkBody) {
    const card = await this.prisma.client.creditCard.findUnique({ where: { id: body.cardId } });
    if (!card || card.bankId !== body.bankId) throw new AppError('VALIDATION_FAILED', 'Card must belong to the same bank.');
    const x = await this.prisma.client.productCodeCrosswalk.upsert({
      where: { bankId_misProductCode: { bankId: body.bankId, misProductCode: body.misProductCode } },
      create: { ...body, confirmedByUserId: actor.userId },
      update: { cardId: body.cardId, confirmedByUserId: actor.userId, at: new Date() },
    });
    RequestContextStore.audit({ entityId: x.id, after: body });
    return x;
  }
}
