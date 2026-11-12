const { nativewindTheme } = require('@kbs/ui-tokens');
const plugin = require('tailwindcss/plugin');

const base = nativewindTheme('light');

/**
 * F-820: Manrope, registered per weight (expo-font cannot group weights under one family at runtime), so the weight
 * utilities select the matching face. The scale is shifted one step heavier than the utility name says — body is 500,
 * `font-medium` (labels, titles) is 600, `font-semibold` (figures) is 700 — so existing screens gain hierarchy without
 * each one being rewritten. `font-normal` is the default applied by the `Text` primitive.
 */
const fontWeights = plugin(({ addUtilities }) => {
  addUtilities({
    '.font-normal': { fontFamily: 'Manrope_500Medium' },
    '.font-medium': { fontFamily: 'Manrope_600SemiBold' },
    '.font-semibold': { fontFamily: 'Manrope_700Bold' },
    '.font-bold': { fontFamily: 'Manrope_800ExtraBold' },
    '.font-extrabold': { fontFamily: 'Manrope_800ExtraBold' },
  });
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // F-805: light-only app; dark variants are opt-in by class so a dark system theme never half-applies.
  darkMode: 'class',
  corePlugins: { fontWeight: false },
  theme: {
    extend: {
      ...base,
      colors: {
        ...base.colors,
        /*
         * F-820: flat neutral canvas, pure white surfaces, no gradient or blur. Token *names* stay so screens keep
         * compiling: canvas = page, surface/card = white card, raised = the fill that groups things inside a card
         * (instead of an outline), navy/ink/brand = primary text, indigo/gold/orange = the one accent. `gold`
         * (#C2410C) is the action colour — white text on it is 5.2:1; the bright #F05A28 is for small marks only.
         */
        background: '#F4F3F1',
        foreground: '#16130F',
        canvas: '#F4F3F1',
        surface: '#FFFFFF',
        raised: '#F1EFEC',
        navy: '#16130F',
        ink: '#16130F',
        brand: '#16130F',
        secondary: { DEFAULT: '#F1EFEC', foreground: '#4A433E' },
        muted: { DEFAULT: '#F1EFEC', foreground: '#6A625D' },
        subtle: '#6A625D',
        indigo: '#C2410C',
        orange: { DEFAULT: '#F05A28', strong: '#C2410C', soft: '#FDF1EC' },
        teal: { DEFAULT: '#0F766E', soft: '#E6F4F2', bright: '#0F766E' },
        gold: { DEFAULT: '#C2410C', soft: '#FDF1EC', ink: '#9A3412' },
        line: '#ECE9E5',
        border: '#ECE9E5',
      },
      // F-820 type scale (px, line height): 12 meta · 13 caption · 14 secondary · 16 body · 18 title · 24 heading ·
      // 30 page figure · 38 key figure. Use these instead of text-[NNpx].
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        md: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '26px'],
        xl: ['24px', '30px'],
        '2xl': ['30px', '36px'],
        '3xl': ['38px', '44px'],
      },
      // F-820: controls 14, cards 18–22, sheets 28; pills (rounded-full) for avatars, dots, toggles and chips
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '28px',
      },
    },
  },
  plugins: [fontWeights],
};
