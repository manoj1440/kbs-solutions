import * as ScreenCapture from 'expo-screen-capture';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';

import { isProtectedRoute } from '@/lib/secure-routes';

const KEY = 'kbs-protected';

/**
 * F-302: applies FLAG_SECURE from the route policy in `lib/secure-routes.ts`. Mounted once in the root layout, so moving
 * between two protected screens never briefly re-allows capture. Does not block assistive technologies (REQ-20 §20.5);
 * residual risks are in DOCS/runbooks/02-mobile-security-limits.md.
 */
export function ScreenProtection() {
  const segments = useSegments();
  const protect = isProtectedRoute(segments);
  useEffect(() => {
    void (protect ? ScreenCapture.preventScreenCaptureAsync(KEY) : ScreenCapture.allowScreenCaptureAsync(KEY)).catch(() => undefined);
  }, [protect]);
  return null;
}
