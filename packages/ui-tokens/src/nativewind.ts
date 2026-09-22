import { palette, radius } from './tokens';

const hsl = (v: string) => `hsl(${v})`;

/** Tailwind/NativeWind `theme.extend` fragment for the mobile app (mirrors web CSS variables). */
export function nativewindTheme(mode: 'light' | 'dark' = 'light') {
  const p = palette[mode];
  return {
    colors: {
      background: hsl(p.background),
      foreground: hsl(p.foreground),
      card: { DEFAULT: hsl(p.card), foreground: hsl(p.cardForeground) },
      popover: { DEFAULT: hsl(p.popover), foreground: hsl(p.popoverForeground) },
      primary: { DEFAULT: hsl(p.primary), foreground: hsl(p.primaryForeground) },
      secondary: { DEFAULT: hsl(p.secondary), foreground: hsl(p.secondaryForeground) },
      muted: { DEFAULT: hsl(p.muted), foreground: hsl(p.mutedForeground) },
      accent: { DEFAULT: hsl(p.accent), foreground: hsl(p.accentForeground) },
      destructive: { DEFAULT: hsl(p.destructive), foreground: hsl(p.destructiveForeground) },
      success: { DEFAULT: hsl(p.success), foreground: hsl(p.successForeground) },
      warning: { DEFAULT: hsl(p.warning), foreground: hsl(p.warningForeground) },
      info: { DEFAULT: hsl(p.info), foreground: hsl(p.infoForeground) },
      unknown: { DEFAULT: hsl(p.unknown), foreground: hsl(p.unknownForeground) },
      'provenance-bank-mis': { DEFAULT: hsl(p.provenanceBankMis), foreground: hsl(p.provenanceBankMisForeground) },
      'provenance-kbs-operational': {
        DEFAULT: hsl(p.provenanceKbsOperational),
        foreground: hsl(p.provenanceKbsOperationalForeground),
      },
      'provenance-kbs-payment': { DEFAULT: hsl(p.provenanceKbsPayment), foreground: hsl(p.provenanceKbsPaymentForeground) },
      border: hsl(p.border),
      input: hsl(p.input),
      ring: hsl(p.ring),
    },
    borderRadius: { sm: `${radius.sm}px`, md: `${radius.md}px`, lg: `${radius.lg}px`, xl: `${radius.xl}px` },
  };
}
