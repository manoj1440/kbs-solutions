import { normalizePincode } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { findHeader, parseTabular } from '../../common/import/tabular';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FilesService } from '../files/files.service';

export interface PincodeLookup {
  pincode: string;
  resolved: boolean;
  district: string | null;
  state: string | null;
  offices: string[];
}

/** F-304: public India Post pincode directory → city/state resolution (REQ-06 §6.1). Never used for sourceability. */
@Injectable()
export class PincodeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async lookup(raw: string): Promise<PincodeLookup> {
    let pincode: string;
    try {
      pincode = normalizePincode(raw);
    } catch {
      return { pincode: raw, resolved: false, district: null, state: null, offices: [] };
    }
    const rows = await this.prisma.client.pincodeMaster.findMany({ where: { pincode }, orderBy: { officeName: 'asc' } });
    if (rows.length === 0) return { pincode, resolved: false, district: null, state: null, offices: [] };
    return { pincode, resolved: true, district: rows[0]?.district ?? null, state: rows[0]?.state ?? null, offices: rows.map((r) => r.officeName) };
  }

  async lookupMany(pincodes: string[]): Promise<Map<string, { district: string; state: string }>> {
    const rows = await this.prisma.client.pincodeMaster.findMany({ where: { pincode: { in: pincodes } }, select: { pincode: true, district: true, state: true }, distinct: ['pincode'] });
    return new Map(rows.map((r) => [r.pincode, { district: r.district, state: r.state }]));
  }

  /** Upsert from a CSV/XLSX (India Post export headers: Pincode, OfficeName, District, StateName — aliases tolerated). */
  async import(fileId: string) {
    const { file, body } = await this.files.readBytes(fileId);
    if (file.purpose !== 'PINCODE_MASTER') throw new AppError('VALIDATION_FAILED', 'Upload the file with purpose PINCODE_MASTER first.');
    const { sheet } = await parseTabular(body, file.contentType);
    const hPin = findHeader(sheet.headers, ['Pincode', 'pincode', 'PINCODE', 'Pin Code']);
    const hOffice = findHeader(sheet.headers, ['OfficeName', 'Office Name', 'officename', 'Office']);
    const hDistrict = findHeader(sheet.headers, ['District', 'DistrictName', 'district']);
    const hState = findHeader(sheet.headers, ['StateName', 'State', 'state', 'STATE']);
    if (!hPin || !hDistrict || !hState) throw new AppError('VALIDATION_FAILED', 'Need Pincode, District and State columns.', { headers: sheet.headers });
    let upserted = 0;
    let invalid = 0;
    const batch: Array<{ pincode: string; officeName: string; district: string; state: string }> = [];
    const flush = async () => {
      if (!batch.length) return;
      await this.prisma.client.$transaction(
        batch.map((b) =>
          this.prisma.client.pincodeMaster.upsert({ where: { pincode_officeName: { pincode: b.pincode, officeName: b.officeName } }, update: { district: b.district, state: b.state, importedAt: new Date() }, create: b }),
        ),
      );
      upserted += batch.length;
      batch.length = 0;
    };
    for (const r of sheet.rows) {
      try {
        const pincode = normalizePincode(r[hPin] ?? '', { padNumeric: true });
        batch.push({ pincode, officeName: (hOffice ? r[hOffice] : '') || 'HO', district: r[hDistrict] ?? '', state: r[hState] ?? '' });
        if (batch.length >= 500) await flush();
      } catch {
        invalid++;
      }
    }
    await flush();
    RequestContextStore.audit({ entityId: fileId, metadata: { upserted, invalid } });
    return { upserted, invalid, headers: { pincode: hPin, office: hOffice, district: hDistrict, state: hState } };
  }
}
