import { z } from 'zod';

import { OtpPurpose, Platform, Role, UserStatus } from '../enums';
import { isValidE164India } from '../normalize';

export const MobileSchema = z
  .string()
  .min(10)
  .max(16)
  .refine((v) => isValidE164India(v), 'Enter a valid Indian mobile number');

export const OtpRequestBody = z.object({
  mobile: MobileSchema,
  purpose: z.enum(Object.values(OtpPurpose) as [OtpPurpose, ...OtpPurpose[]]).default('LOGIN'),
});
export type OtpRequestBody = z.infer<typeof OtpRequestBody>;

export const OtpRequestResponse = z.object({
  challengeId: z.string().uuid(),
  expiresInSec: z.number().int(),
  resendAfterSec: z.number().int(),
});
export type OtpRequestResponse = z.infer<typeof OtpRequestResponse>;

export const OtpVerifyBody = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  platform: z.enum(Object.values(Platform) as [Platform, ...Platform[]]),
  deviceId: z.string().max(128).optional(),
  appVersion: z.string().max(32).optional(),
  pushToken: z.string().max(256).optional(),
});
export type OtpVerifyBody = z.infer<typeof OtpVerifyBody>;

export const RefreshBody = z.object({ refreshToken: z.string().min(20).optional() });

export const TrainingGate = z.object({
  required: z.boolean(),
  passed: z.boolean(),
  status: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  currentModuleSequence: z.number().int().nullable(),
  reason: z.string().nullable(),
});
export const NetworkGate = z.object({
  required: z.boolean(),
  allowed: z.boolean(),
  reason: z.string().nullable(),
});
export const OnboardingGate = z.object({
  required: z.boolean(),
  complete: z.boolean(),
  step: z.string().nullable(),
});
export const AccountGate = z.object({ active: z.boolean(), reason: z.string().nullable() });

export const Gates = z.object({
  account: AccountGate,
  training: TrainingGate,
  network: NetworkGate,
  onboarding: OnboardingGate,
});
export type Gates = z.infer<typeof Gates>;

export const UserSummary = z.object({
  id: z.string().uuid(),
  publicRef: z.string(),
  role: z.enum(Object.values(Role) as [Role, ...Role[]]),
  status: z.enum(Object.values(UserStatus) as [UserStatus, ...UserStatus[]]),
  fullName: z.string(),
  mobileMasked: z.string(),
  email: z.string().nullable(),
  employeeCode: z.string().nullable(),
  reportingParent: z
    .object({ id: z.string().uuid(), fullName: z.string(), role: z.string() })
    .nullable(),
});
export type UserSummary = z.infer<typeof UserSummary>;

export const AuthSessionResponse = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  accessExpiresInSec: z.number().int(),
  user: UserSummary,
  gates: Gates,
  permissions: z.array(z.string()),
});
export type AuthSessionResponse = z.infer<typeof AuthSessionResponse>;

export const MeResponse = z.object({ user: UserSummary, gates: Gates, permissions: z.array(z.string()) });
export type MeResponse = z.infer<typeof MeResponse>;

/** F-302: device integrity report from the mobile app (REQ-09 §9.3). Informational: never a hard block (policy OPEN). */
export const DeviceIntegrityBody = z.object({
  rooted: z.boolean(),
  platform: z.enum(['ANDROID', 'IOS']),
  appVersion: z.string().max(40).optional(),
  deviceModel: z.string().max(80).optional(),
});
export type DeviceIntegrityBody = z.infer<typeof DeviceIntegrityBody>;
