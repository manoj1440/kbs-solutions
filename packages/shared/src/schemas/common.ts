import { z } from 'zod';

import { ErrorCode, RecoveryHint } from '../errors';

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z
    .string()
    .regex(/^[a-zA-Z0-9_.]+:(asc|desc)$/)
    .optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

export const ApiMeta = z.object({
  requestId: z.string(),
  asOf: z.string().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  total: z.number().optional(),
  idempotentReplay: z.boolean().optional(),
  dateBasis: z.string().optional(),
});
export type ApiMeta = z.infer<typeof ApiMeta>;

export const ApiError = z.object({
  code: z.enum(Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]]),
  message: z.string(),
  details: z.unknown().optional(),
  recovery: z.enum(Object.values(RecoveryHint) as [RecoveryHint, ...RecoveryHint[]]).optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export const apiEnvelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data, meta: ApiMeta });
export const apiErrorEnvelope = z.object({ error: ApiError, meta: ApiMeta });

export const StatusFieldSchema = z.object({
  value: z.string().nullable(),
  raw: z.string().nullable(),
  provenance: z.enum(['BANK_MIS', 'KBS_OPERATIONAL', 'KBS_PAYMENT']),
  asOf: z.string().nullable(),
  batchRef: z.string().nullable(),
  display: z.string(),
});

export const IdParam = z.object({ id: z.string().uuid() });
export const ReasonBody = z.object({ reason: z.string().min(3).max(500) });
