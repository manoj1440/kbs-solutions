/**
 * Design tokens shared by web (shadcn/ui via CSS variables) and mobile (NativeWind theme).
 * Colours are HSL triplets ("h s% l%") so they slot straight into shadcn's `hsl(var(--x))` convention.
 * REQ-20 §20.1: shared spacing, typography, semantic colours, shape; §20.2: text never colour-only.
 */
export const palette = {
  light: {
    background: '0 0% 100%',
    foreground: '224 71% 4%',
    card: '0 0% 100%',
    cardForeground: '224 71% 4%',
    popover: '0 0% 100%',
    popoverForeground: '224 71% 4%',
    primary: '221 83% 45%',
    primaryForeground: '0 0% 100%',
    secondary: '220 14% 96%',
    secondaryForeground: '220 9% 26%',
    muted: '220 14% 96%',
    mutedForeground: '220 9% 40%',
    accent: '220 14% 94%',
    accentForeground: '224 71% 4%',
    destructive: '0 72% 42%',
    destructiveForeground: '0 0% 100%',
    success: '150 60% 30%',
    successForeground: '0 0% 100%',
    warning: '35 92% 33%',
    warningForeground: '0 0% 100%',
    info: '199 89% 34%',
    infoForeground: '0 0% 100%',
    border: '220 13% 88%',
    input: '220 13% 88%',
    ring: '221 83% 45%',
    // provenance chips (REQ-20 §20.3)
    provenanceBankMis: '262 60% 40%',
    provenanceBankMisForeground: '0 0% 100%',
    provenanceKbsOperational: '199 60% 32%',
    provenanceKbsOperationalForeground: '0 0% 100%',
    provenanceKbsPayment: '150 50% 28%',
    provenanceKbsPaymentForeground: '0 0% 100%',
    // unknown / not reported
    unknown: '220 9% 46%',
    unknownForeground: '0 0% 100%',
  },
  dark: {
    background: '224 71% 4%',
    foreground: '210 20% 98%',
    card: '224 71% 6%',
    cardForeground: '210 20% 98%',
    popover: '224 71% 6%',
    popoverForeground: '210 20% 98%',
    primary: '217 91% 66%',
    primaryForeground: '224 71% 4%',
    secondary: '215 28% 17%',
    secondaryForeground: '210 20% 98%',
    muted: '215 28% 17%',
    mutedForeground: '217 11% 72%',
    accent: '215 28% 20%',
    accentForeground: '210 20% 98%',
    destructive: '0 72% 60%',
    destructiveForeground: '224 71% 4%',
    success: '150 60% 55%',
    successForeground: '224 71% 4%',
    warning: '38 92% 60%',
    warningForeground: '224 71% 4%',
    info: '199 89% 60%',
    infoForeground: '224 71% 4%',
    border: '215 28% 22%',
    input: '215 28% 22%',
    ring: '217 91% 66%',
    provenanceBankMis: '262 70% 75%',
    provenanceBankMisForeground: '224 71% 4%',
    provenanceKbsOperational: '199 70% 70%',
    provenanceKbsOperationalForeground: '224 71% 4%',
    provenanceKbsPayment: '150 55% 65%',
    provenanceKbsPaymentForeground: '224 71% 4%',
    unknown: '217 11% 72%',
    unknownForeground: '224 71% 4%',
  },
} as const;
export type PaletteKey = keyof typeof palette.light;

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 9999 } as const;
export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 } as const;
export const lineHeight = { xs: 16, sm: 20, base: 24, lg: 28, xl: 28, '2xl': 32, '3xl': 36 } as const;
export const fontFamily = { sans: 'Inter', mono: 'JetBrains Mono' } as const;
export const touchTarget = { min: 44 } as const; // REQ-20 §20.5 large touch targets
export const zIndex = { base: 0, dropdown: 40, sticky: 50, overlay: 60, modal: 70, toast: 80 } as const;

/** Visual intent per status family; text labels are always rendered alongside (REQ-20 §20.2). */
export const statusIntent = {
  stage: { known: 'info', unknown: 'unknown' },
  decision: { approve: 'success', decline: 'destructive', inprocess: 'warning', unknown: 'unknown' },
  activation: { active: 'success', inactive: 'warning', unknown: 'unknown' },
  payout: {
    available: 'info',
    reserved: 'warning',
    pendingApproval: 'warning',
    approved: 'info',
    paid: 'success',
    rejected: 'destructive',
    onHold: 'destructive',
    underReview: 'warning',
  },
} as const;
