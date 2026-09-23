export const statusVariant = (s: string) =>
  (s === 'ACTIVE'
    ? 'success'
    : s === 'PENDING_ONBOARDING'
      ? 'warning'
      : s === 'BLOCKED'
        ? 'destructive'
        : 'unknown') as 'success' | 'warning' | 'destructive' | 'unknown';
