import { type Tone, TONE } from '@/components/ui/kit';

export const statusVariant = (s: string) =>
  (s === 'ACTIVE'
    ? 'success'
    : s === 'PENDING_ONBOARDING'
      ? 'warning'
      : s === 'BLOCKED'
        ? 'destructive'
        : 'unknown') as 'success' | 'warning' | 'destructive' | 'unknown';

/** F-806: dot tone per KBS user status (the humanised text always carries the meaning). */
export const statusTone = (s: string): Tone =>
  s === 'ACTIVE'
    ? 'emerald'
    : s === 'PENDING_ONBOARDING'
      ? 'amber'
      : s === 'BLOCKED'
        ? 'rose'
        : 'slate';

/** F-806: chip colour per role, so a team reads at a glance. */
export const ROLE_TONE: Record<string, Tone> = {
  ADMIN: 'teal',
  MANAGER: 'indigo',
  TELECALLER: 'sky',
  ADVISOR: 'violet',
  ACCOUNTS: 'amber',
};

/** Classes for a role chip (`<span className={roleChipClass(role)}>{humanize(role)}</span>`). */
export const roleChipClass = (role: string) =>
  `inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] leading-5 font-semibold whitespace-nowrap ring-1 ring-inset ${TONE[ROLE_TONE[role] ?? 'slate'].tile}`;
