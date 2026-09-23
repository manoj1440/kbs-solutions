import { Platform, type ViewStyle } from 'react-native';

/**
 * F-805 design tokens used from JS (icons, gradients, shadows, card art). Tailwind classes mirror these names
 * (`bg-navy`, `text-gold`, `bg-canvas` …) — keep both in sync with tailwind.config.js.
 */
export const colors = {
  navy: '#0A1E42',
  ink: '#0B1533',
  brand: '#16329E',
  indigo: '#3D5AFE',
  gold: '#F5B942',
  goldSoft: '#FFF4DB',
  canvas: '#F4F6FB',
  surface: '#FFFFFF',
  line: '#E6EAF2',
  text: '#0B1533',
  muted: '#5B6478',
  subtle: '#8A93A6',
  white: '#FFFFFF',
  success: '#1F7A4D',
  successSoft: '#E6F4EC',
  warning: '#9A5B06',
  warningSoft: '#FFF3DC',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  info: '#0B6E99',
  infoSoft: '#E4F3FA',
  unknown: '#6B7280',
  unknownSoft: '#EEF0F4',
} as const;

export const gradients = {
  hero: ['#0A1E42', '#16329E', '#3D5AFE'],
  heroDeep: ['#050F26', '#0A1E42', '#1B3BB3'],
  gold: ['#F9D37A', '#F5B942', '#E39B1B'],
  success: ['#0F5132', '#1F7A4D', '#2FA36B'],
  sunset: ['#7C2D12', '#C2410C', '#F59E0B'],
} as const;

/** Deterministic card-art palettes (no bank logos or brand marks — generic gradients only). */
const CARD_ART: readonly (readonly [string, string, string])[] = [
  ['#0A1E42', '#16329E', '#4C6FFF'],
  ['#3B0A2A', '#8E1B4E', '#D9466F'],
  ['#062E2B', '#0E6B5E', '#22B59A'],
  ['#2A1406', '#8A4B0C', '#E39B1B'],
  ['#1A1033', '#4B2A99', '#8B6CF6'],
  ['#0B1F2A', '#12506B', '#2A9BC7'],
  ['#1C1C1E', '#3A3A3C', '#8E8E93'],
];
export function cardArt(seed: string): readonly [string, string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CARD_ART[h % CARD_ART.length]!;
}

const AVATAR = ['#16329E', '#8E1B4E', '#0E6B5E', '#8A4B0C', '#4B2A99', '#12506B'];
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
  sm: { boxShadow: '0px 1px 2px rgba(11, 21, 51, 0.06), 0px 1px 3px rgba(11, 21, 51, 0.06)' } as ViewStyle,
  md: { boxShadow: '0px 4px 14px rgba(11, 21, 51, 0.08)' } as ViewStyle,
  lg: { boxShadow: '0px 12px 32px rgba(11, 21, 51, 0.14)' } as ViewStyle,
  glow: { boxShadow: '0px 10px 24px rgba(22, 50, 158, 0.35)' } as ViewStyle,
  gold: { boxShadow: '0px 10px 24px rgba(227, 155, 27, 0.35)' } as ViewStyle,
};

export type Tone = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'unknown';
export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  default: { fg: colors.brand, bg: '#E8EDFF' },
  secondary: { fg: '#374151', bg: '#EEF0F4' },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  destructive: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  unknown: { fg: '#4B5563', bg: colors.unknownSoft },
};
