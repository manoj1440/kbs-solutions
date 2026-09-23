import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { api } from '@/lib/api';

/**
 * F-302 (REQ-09 §9.3): best-effort root / compromised-device detection after sign-in. A rooted device gets a warning
 * banner and the report is audited server-side (Admin alerted) — never a hard block (policy OPEN).
 */
export async function checkDeviceIntegrity(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const rooted = await Device.isRootedExperimentalAsync();
    const r = await api.post<{ warning: string | null }>('/auth/device-integrity', {
      rooted,
      platform: 'ANDROID',
      appVersion: Constants.expoConfig?.version,
      deviceModel: Device.modelName ?? undefined,
    });
    return r.data.warning;
  } catch {
    return null;
  }
}
