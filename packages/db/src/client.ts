import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

import { isInMisApplyContext } from './mis-apply-context';

export class BankStatusWriteForbiddenError extends Error {
  readonly code = 'BANK_STATUS_WRITE_FORBIDDEN';
  constructor(model: string, operation: string) {
    super(
      `INV-01: ${model}.${operation} is only allowed inside withMisApplyContext(). ` +
        'Bank-reported status may only be written by the MIS apply service.',
    );
    this.name = 'BankStatusWriteForbiddenError';
  }
}

const PROTECTED_MODELS = new Set(['BankStatusSnapshot', 'BankStatusHistory']);
const WRITE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

export interface CreatePrismaClientOptions {
  connectionString: string;
  log?: Array<'query' | 'info' | 'warn' | 'error'>;
}

/**
 * Creates the application Prisma client:
 * - pg driver adapter (Prisma 7)
 * - INV-01 extension: throws on any write to bank-status tables outside the MIS apply context
 */
export function createPrismaClient(opts: CreatePrismaClientOptions) {
  const adapter = new PrismaPg({ connectionString: opts.connectionString });
  const base = new PrismaClient({ adapter, log: opts.log ?? ['warn', 'error'] });

  return base.$extends({
    name: 'bank-status-write-guard',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (PROTECTED_MODELS.has(model) && WRITE_OPS.has(operation) && !isInMisApplyContext()) {
            throw new BankStatusWriteForbiddenError(model, operation);
          }
          return query(args);
        },
      },
    },
  });
}

export type KbsPrismaClient = ReturnType<typeof createPrismaClient>;
