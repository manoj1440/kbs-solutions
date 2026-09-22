import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import QRCode from 'qrcode';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';

export interface IdCardFields {
  fullName: string;
  employeeCode: string | null;
  role: string;
  issuedAt: string;
  verifyUrl: string;
  publicRef: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * Template v1 (REQ-08 §8.4): logo placeholder, name, employee code, role, issued date, QR → verify URL.
 * Intentionally contains NO mobile, PAN, customer or payout data — the template test asserts this.
 */
export function renderIdCardSvg(fields: IdCardFields, qrSvgInner: string, visible: string[]): string {
  const show = (k: keyof IdCardFields) => visible.includes(k);
  const lines: string[] = [];
  if (show('fullName')) lines.push(`<text x="40" y="150" font-size="34" font-weight="700" fill="#0f172a">${esc(fields.fullName)}</text>`);
  if (show('role')) lines.push(`<text x="40" y="190" font-size="20" fill="#334155">${esc(fields.role)}</text>`);
  if (show('employeeCode') && fields.employeeCode) lines.push(`<text x="40" y="230" font-size="20" font-family="monospace" fill="#0f172a">${esc(fields.employeeCode)}</text>`);
  if (show('issuedAt')) lines.push(`<text x="40" y="290" font-size="15" fill="#64748b">Issued ${esc(fields.issuedAt.slice(0, 10))}</text>`);
  if (show('verifyUrl')) lines.push(`<text x="40" y="315" font-size="13" fill="#64748b">Verify: ${esc(fields.verifyUrl)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="KBS Solutions official ID card">
  <rect width="640" height="360" rx="24" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="0" y="0" width="640" height="84" rx="24" fill="#1d4ed8"/>
  <rect x="0" y="40" width="640" height="44" fill="#1d4ed8"/>
  <text x="40" y="54" font-size="26" font-weight="700" fill="#ffffff" font-family="Helvetica, Arial, sans-serif">KBS Solutions</text>
  <text x="40" y="74" font-size="13" fill="#dbeafe" font-family="Helvetica, Arial, sans-serif">Official ID · Credit Card DSA</text>
  <g font-family="Helvetica, Arial, sans-serif">${lines.join('')}</g>
  <g transform="translate(470 120) scale(5.2)">${qrSvgInner}</g>
  <text x="535" y="290" font-size="11" text-anchor="middle" fill="#64748b" font-family="Helvetica, Arial, sans-serif">Scan to verify</text>
</svg>`;
}

/** F-312: official Telecaller ID card — versioned, rendered to storage, verifiable by public ref, revoked on deactivation. */
@Injectable()
export class IdCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  verifyUrl(publicRef: string) {
    return `${this.env.WEB_ORIGIN}/verify/${publicRef}`;
  }

  private visibleFields(): string[] {
    return this.config.getJson<string[]>('idcard.fields') ?? ['fullName', 'employeeCode', 'role', 'issuedAt', 'verifyUrl'];
  }

  /** Renders (or re-renders) the current card of a user into a StoredFile(ID_CARD, image/svg+xml). */
  async ensureRendered(userId: string) {
    const card = await this.prisma.client.officialIdCard.findFirst({ where: { userId, revokedAt: null }, orderBy: { version: 'desc' }, include: { user: { select: { fullName: true, employeeCode: true, publicRef: true, role: true } } } });
    if (!card) return null;
    if (card.renderedFileId) return card;
    const fields: IdCardFields = { fullName: card.user.fullName, employeeCode: card.user.employeeCode, role: 'Telecaller', issuedAt: card.issuedAt.toISOString(), verifyUrl: this.verifyUrl(card.user.publicRef), publicRef: card.user.publicRef };
    const qr = await QRCode.toString(fields.verifyUrl, { type: 'svg', margin: 0 });
    const qrInner = qr.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const svg = renderIdCardSvg(fields, qrInner, this.visibleFields());
    const body = Buffer.from(svg, 'utf8');
    const key = `private/id_card/${randomUUID()}.svg`;
    await this.storage.put({ bucket: this.env.S3_BUCKET, key, body, contentType: 'image/svg+xml' });
    const file = await this.prisma.client.storedFile.create({ data: { bucket: this.env.S3_BUCKET, key, originalName: `kbs-id-${card.user.employeeCode ?? card.user.publicRef}.svg`, contentType: 'image/svg+xml', sizeBytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), uploadedByUserId: userId, purpose: 'ID_CARD', scanStatus: 'CLEAN', scannedAt: new Date() } });
    return this.prisma.client.officialIdCard.update({ where: { id: card.id }, data: { renderedFileId: file.id, fields: { ...fields } }, include: { user: { select: { fullName: true, employeeCode: true, publicRef: true, role: true } } } });
  }

  /** Telecaller's own card (view + SVG). Managers/Admin may fetch a team member's card for support. */
  async get(actor: Actor, userId: string) {
    if (actor.userId !== userId && actor.role !== 'ADMIN' && !(actor.role === 'MANAGER' && actor.teamUserIds.includes(userId))) throw AppError.notFound('ID card');
    const card = await this.ensureRendered(userId);
    if (!card) {
      const revoked = await this.prisma.client.officialIdCard.findFirst({ where: { userId }, orderBy: { version: 'desc' } });
      if (!revoked) throw AppError.notFound('ID card');
      return { id: revoked.id, version: revoked.version, status: 'REVOKED' as const, revokedAt: revoked.revokedAt?.toISOString() ?? null, fields: revoked.fields, svg: null };
    }
    const svg = (await this.storage.get({ bucket: this.env.S3_BUCKET, key: (await this.prisma.client.storedFile.findUniqueOrThrow({ where: { id: card.renderedFileId as string } })).key })).toString('utf8');
    if (actor.userId !== userId) await this.audit.sensitiveAccess({ entityType: 'OfficialIdCard', entityId: card.id, field: 'ID_CARD', purpose: 'VIEW' });
    return { id: card.id, version: card.version, status: 'ACTIVE' as const, revokedAt: null, fields: card.fields, renderedFileId: card.renderedFileId, svg, verifyUrl: this.verifyUrl(card.user.publicRef) };
  }

  /** Public verification: name + code + validity only (REQ-08 §8.4). */
  async verify(publicRef: string) {
    const user = await this.prisma.client.user.findUnique({ where: { publicRef }, select: { id: true, fullName: true, employeeCode: true, role: true, status: true } });
    if (!user || user.role !== 'TELECALLER') return { valid: false as const, reason: 'NOT_FOUND' as const };
    const card = await this.prisma.client.officialIdCard.findFirst({ where: { userId: user.id }, orderBy: { version: 'desc' } });
    if (!card) return { valid: false as const, reason: 'NOT_FOUND' as const };
    if (card.revokedAt || user.status !== 'ACTIVE') return { valid: false as const, reason: 'REVOKED' as const, fullName: user.fullName, employeeCode: user.employeeCode, revokedAt: card.revokedAt?.toISOString() ?? null };
    return { valid: true as const, fullName: user.fullName, employeeCode: user.employeeCode, role: 'Telecaller', issuedAt: card.issuedAt.toISOString(), version: card.version };
  }

  /** Called on deactivation (F-103) — the card verifies as revoked and can no longer be shared. */
  async revokeAll(userId: string, reason: string) {
    const r = await this.prisma.client.officialIdCard.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (r.count) RequestContextStore.audit({ entityId: userId, after: { idCardsRevoked: r.count }, reason });
    return r.count;
  }

  /** Admin/Manager regenerate (new version; previous revoked). */
  async regenerate(actor: Actor, userId: string, reason: string) {
    const u = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!u || u.role !== 'TELECALLER') throw AppError.notFound('User');
    if (actor.role === 'MANAGER' && !actor.teamUserIds.includes(userId)) throw AppError.notFound('User');
    if (u.status !== 'ACTIVE') throw new AppError('CONFLICT', 'Only active Telecallers get an ID card.');
    const latest = await this.prisma.client.officialIdCard.aggregate({ where: { userId }, _max: { version: true } });
    await this.prisma.client.$transaction([
      this.prisma.client.officialIdCard.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.client.officialIdCard.create({ data: { userId, version: (latest._max.version ?? 0) + 1, fields: { fullName: u.fullName, employeeCode: u.employeeCode, role: 'Telecaller', issuedAt: new Date().toISOString() } } }),
    ]);
    RequestContextStore.audit({ entityId: userId, after: { version: (latest._max.version ?? 0) + 1 }, reason });
    return this.get(actor, userId);
  }
}
