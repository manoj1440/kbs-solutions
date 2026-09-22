import { z } from 'zod';

import { Role, UserStatus } from '../enums';

import { MobileSchema } from './auth';
import { PaginationQuery } from './common';

export const CreateUserBody = z.object({
  role: z.enum(['MANAGER', 'ACCOUNTS']),
  fullName: z.string().trim().min(2).max(120),
  mobile: MobileSchema,
  email: z.string().email().optional(),
});
export type CreateUserBody = z.infer<typeof CreateUserBody>;

export const CreateTelecallerBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  mobile: MobileSchema,
});
export type CreateTelecallerBody = z.infer<typeof CreateTelecallerBody>;

export const UserListQuery = PaginationQuery.extend({
  role: z.enum(Object.values(Role) as [Role, ...Role[]]).optional(),
  status: z.enum(Object.values(UserStatus) as [UserStatus, ...UserStatus[]]).optional(),
  q: z.string().trim().max(60).optional(),
  managerId: z.string().uuid().optional(),
});
export type UserListQuery = z.infer<typeof UserListQuery>;

export const LifecycleBody = z.object({ reason: z.string().min(3).max(500) });

// ── F-106 Agent Codes & reporting hierarchy ──
export const CreateAgentCodeBody = z.object({
  ownerUserId: z.string().uuid(),
  code: z.string().trim().min(4).max(12).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
export type CreateAgentCodeBody = z.infer<typeof CreateAgentCodeBody>;

export const ApplyAgentCodeBody = z.object({ code: z.string().trim().min(4).max(12) });
export type ApplyAgentCodeBody = z.infer<typeof ApplyAgentCodeBody>;

export const ReassignReportingBody = z.object({ parentUserId: z.string().uuid(), reason: z.string().min(3).max(500) });
export type ReassignReportingBody = z.infer<typeof ReassignReportingBody>;

export const AgentCodeApplyResult = z.object({
  status: z.enum(['APPLIED', 'PENDING_APPROVAL']),
  reportingParent: z.object({ id: z.string().uuid(), fullName: z.string(), role: z.string() }),
});
export type AgentCodeApplyResult = z.infer<typeof AgentCodeApplyResult>;
