/**
 * F-819 mobile app version policy. Admin sets `app.{android,ios}.{minVersion,latestVersion,downloadUrl}`; the app reads
 * them from the public `GET /app/version` and compares against its own version (app.json `version`).
 */
export type AppPlatform = 'android' | 'ios';

export interface AppVersionPolicy {
  minVersion: string | null;
  latestVersion: string | null;
  downloadUrl: string | null;
}
export type AppVersionResponse = Record<AppPlatform, AppVersionPolicy>;

export type AppUpdateState = 'required' | 'available' | 'current';

/** Numeric dotted-version compare (`1.10.0` > `1.9.2`); missing parts are 0, non-numeric parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.trim().split('.');
  const pb = b.trim().split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number.parseInt(pa[i] ?? '0', 10) || 0;
    const y = Number.parseInt(pb[i] ?? '0', 10) || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Below `minVersion` → required (blocked); below `latestVersion` → available (prompt); unset values never block. */
export function appUpdateState(current: string, policy: AppVersionPolicy | null | undefined): AppUpdateState {
  if (!policy) return 'current';
  if (policy.minVersion && compareVersions(current, policy.minVersion) < 0) return 'required';
  if (policy.latestVersion && compareVersions(current, policy.latestVersion) < 0) return 'available';
  return 'current';
}
