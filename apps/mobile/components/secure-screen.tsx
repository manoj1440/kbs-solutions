import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, type PropsWithChildren } from 'react';

/**
 * F-302: FLAG_SECURE for protected surfaces (customer lists, PAN, bank details, payouts, recordings).
 * Does not block assistive technologies (REQ-20 §20.5); residual risks documented in DOCS/runbooks/02-mobile-security-limits.md.
 */
export function SecureScreen({ children }: PropsWithChildren) {
  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync('kbs-protected');
    return () => {
      void ScreenCapture.allowScreenCaptureAsync('kbs-protected');
    };
  }, []);
  return <>{children}</>;
}
