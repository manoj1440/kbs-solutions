import * as shared from '@kbs/shared';
import { describe, expect, it } from 'vitest';


import * as prismaEnums from '../generated/prisma/enums';

/** Prisma enum name → shared enum name where they differ (Postgres forbids enum/table name clashes). */
const NAME_MAP: Record<string, string> = { CallOutcomeKind: 'CallOutcome' };

describe('enum sync (ADR-010)', () => {
  const prismaEnumNames = Object.keys(prismaEnums).filter((k) => {
    const v = (prismaEnums as Record<string, unknown>)[k];
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  });
  it('every Prisma enum exists in @kbs/shared with identical values', () => {
    expect(prismaEnumNames.length).toBeGreaterThan(40);
    for (const name of prismaEnumNames) {
      const sharedName = NAME_MAP[name] ?? name;
      const sharedEnum = (shared as Record<string, unknown>)[sharedName] as Record<string, string> | undefined;
      expect(sharedEnum, `missing shared enum ${sharedName}`).toBeDefined();
      const p = Object.values((prismaEnums as Record<string, Record<string, string>>)[name] as Record<string, string>).sort();
      const s = Object.values(sharedEnum as Record<string, string>).sort();
      expect(s, `values differ for ${name}`).toEqual(p);
    }
  });
});
