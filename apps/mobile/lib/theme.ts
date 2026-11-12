import { Platform, type ViewStyle } from 'react-native';

/**
 * Design tokens used from JS (icons, card art, shadows). Unslop pass: a back-office ledger — one neutral graphite ramp
 * for surfaces and the three text roles, KBS orange as the only accent. Token *names* stay (`navy`, `brand`,
 * `indigo`, `gold` …) so screens keep compiling — read them as: navy/ink/brand/text = primary text, muted = secondary
 * text, subtle = muted text and icons, indigo/gold/orangeStrong = the accent shade that passes 4.5:1 with white,
 * orange = the bright brand orange for small marks only. Keep in sync with tailwind.config.js.
 */
export const colors = {
  navy: '#16130F',
  ink: '#16130F',
  brand: '#16130F',
  indigo: '#C2410C',
  gold: '#C2410C',
  goldSoft: '#FDF1EC',
  orange: '#F05A28',
  orangeStrong: '#C2410C',
  teal: '#0F766E',
  canvas: '#F4F3F1',
  surface: '#FFFFFF',
  raised: '#F1EFEC',
  line: '#ECE9E5',
  text: '#16130F',
  muted: '#4A433E',
  subtle: '#6A625D',
  white: '#FFFFFF',
  success: '#0F766E',
  successSoft: '#E6F4F2',
  warning: '#92580A',
  warningSoft: '#FDF4E3',
  danger: '#B42318',
  dangerSoft: '#FDEDEC',
  info: '#1F5F7A',
  infoSoft: '#EAF2F6',
  unknown: '#737373',
  unknownSoft: '#F5EEE7',
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

/** Avatars are quiet graphite steps (initials carry identity, not hue). */
const AVATAR = ['#404040', '#525252', '#3F3F46', '#52525B', '#44403C', '#4B5563'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 17 + seed.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length]!;
}

/**
 * Linear gradient as a style (RN new-architecture `experimental_backgroundImage`; plain CSS on web). Only for the
 * credit-card art — a card is a real object and keeps its soft material. Never on surfaces, buttons or headers.
 */
export function gradientStyle(stops: readonly string[], angle = 135): ViewStyle {
  const css = `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  if (Platform.OS === 'web') return { backgroundImage: css } as unknown as ViewStyle;
  return { experimental_backgroundImage: css } as ViewStyle;
}

/** F-820: surfaces separate by tone, not by shadow. Only things that float over content (sheets, the centre tab action) keep a soft neutral shadow. */
export const shadow = {
  sm: {} as ViewStyle,
  md: {} as ViewStyle,
  lg: { boxShadow: '0px 10px 30px rgba(22, 19, 15, 0.10)' } as ViewStyle,
};

export type Tone =
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'unknown';
export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  default: { fg: colors.text, bg: colors.raised },
  secondary: { fg: colors.muted, bg: colors.raised },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  destructive: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  unknown: { fg: colors.subtle, bg: colors.unknownSoft },
};
