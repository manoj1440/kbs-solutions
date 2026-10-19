import { Platform, type ViewStyle } from 'react-native';

/**
 * F-805 → F-818 design tokens used from JS (icons, gradients, shadows, card art). F-818 moved them to the web palette
 * (F-817): cream canvas, warm-white surfaces, near-black primary, orange accent, teal for positive. Token *names* stay
 * (`navy`, `brand`, `indigo`, `gold` …) so screens keep compiling — read them as: navy/ink/brand = near-black,
 * indigo/gold = orange accent. Tailwind classes mirror these names — keep both in sync with tailwind.config.js.
 */
export const colors = {
  navy: '#1C1917',
  ink: '#1C1917',
  brand: '#1C1917',
  indigo: '#F05A28',
  gold: '#F05A28',
  goldSoft: '#FDEEE6',
  orange: '#F05A28',
  orangeStrong: '#C2410C',
  teal: '#0F766E',
  canvas: '#F2EEE8',
  surface: '#FFFDFA',
  line: '#E7E1D8',
  text: '#1C1917',
  muted: '#57534E',
  subtle: '#78716C',
  white: '#FFFFFF',
  success: '#0F766E',
  successSoft: '#E3F4F1',
  warning: '#9A5B06',
  warningSoft: '#FFF3DC',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  info: '#1F6F6A',
  infoSoft: '#E6F3F1',
  unknown: '#78716C',
  unknownSoft: '#EFEAE4',
} as const;

export const gradients = {
  /** dark charcoal → warm ember → orange: white text stays readable where it sits (top-left) */
  hero: ['#1C1917', '#3B2418', '#E2561F'],
  heroDeep: ['#0C0A09', '#1C1917', '#44281B'],
  /** the web hero tile (`.brand-gradient`) */
  gold: ['#F47A45', '#F05A28', '#E2461C'],
  success: ['#115E59', '#0F766E', '#14B8A6'],
  sunset: ['#7C2D12', '#C2410C', '#F59E0B'],
} as const;

/** Deterministic card-art palettes (no bank logos or brand marks — generic gradients only). */
const CARD_ART: readonly (readonly [string, string, string])[] = [
  ['#1C1917', '#7C2D12', '#F05A28'],
  ['#3B0A2A', '#8E1B4E', '#D9466F'],
  ['#062E2B', '#0E6B5E', '#22B59A'],
  ['#2A1406', '#8A4B0C', '#E2461C'],
  ['#1A1033', '#4B2A99', '#8B6CF6'],
  ['#0B1F2A', '#12506B', '#2A9BC7'],
  ['#1C1C1E', '#3A3A3C', '#8E8E93'],
];
export function cardArt(seed: string): readonly [string, string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CARD_ART[h % CARD_ART.length]!;
}

const AVATAR = ['#1C1917', '#C2410C', '#0E6B5E', '#8A4B0C', '#4B2A99', '#12506B'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 17 + seed.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length]!;
}

/** Linear gradient as a style (RN new-architecture `experimental_backgroundImage`; plain CSS on web). */
export function gradientStyle(stops: readonly string[], angle = 135): ViewStyle {
  const css = `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  if (Platform.OS === 'web') return { backgroundImage: css } as unknown as ViewStyle;
  return { experimental_backgroundImage: css } as ViewStyle;
}

export const shadow = {
  sm: {
    boxShadow: '0px 1px 2px rgba(28, 25, 23, 0.05), 0px 1px 3px rgba(28, 25, 23, 0.05)',
  } as ViewStyle,
  md: { boxShadow: '0px 4px 14px rgba(28, 25, 23, 0.08)' } as ViewStyle,
  lg: { boxShadow: '0px 12px 32px rgba(28, 25, 23, 0.14)' } as ViewStyle,
  glow: { boxShadow: '0px 10px 24px rgba(28, 25, 23, 0.28)' } as ViewStyle,
  gold: { boxShadow: '0px 10px 24px rgba(240, 90, 40, 0.35)' } as ViewStyle,
};

export type Tone =
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'unknown';
export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  default: { fg: colors.brand, bg: '#EFE9E1' },
  secondary: { fg: '#44403C', bg: '#EFEAE4' },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  destructive: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  unknown: { fg: '#57534E', bg: colors.unknownSoft },
};
