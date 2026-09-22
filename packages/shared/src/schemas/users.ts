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
