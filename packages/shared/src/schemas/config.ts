import { z } from 'zod';

import { ConfigValueType } from '../enums';

export const ConfigEntry = z.object({
  key: z.string(),
  valueType: z.enum(Object.values(ConfigValueType) as [ConfigValueType, ...ConfigValueType[]]),
  value: z.unknown(),
  defaultValue: z.unknown(),
  description: z.string(),
  requiresValueBeforeProd: z.boolean(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type ConfigEntry = z.infer<typeof ConfigEntry>;

export const UpdateConfigBody = z.object({
  value: z.unknown(),
  reason: z.string().min(3).max(500),
});
export type UpdateConfigBody = z.infer<typeof UpdateConfigBody>;

export const LaunchGateItem = z.object({
  key: z.string(),
  description: z.string(),
  isSet: z.boolean(),
});
