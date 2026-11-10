const { nativewindTheme } = require('@kbs/ui-tokens');
const plugin = require('tailwindcss/plugin');

const base = nativewindTheme('light');

/**
 * F-805: Inter faces are registered per weight (expo-font cannot group weights under one family at runtime), so the
 * weight utilities select the matching face. `font-normal` is the default applied by the `Text` primitive; later
 * utilities win because they are emitted after it.
 */
const interWeights = plugin(({ addUtilities }) => {
  addUtilities({
    '.font-normal': { fontFamily: 'Inter_400Regular' },
    '.font-medium': { fontFamily: 'Inter_500Medium' },
    '.font-semibold': { fontFamily: 'Inter_600SemiBold' },
    '.font-bold': { fontFamily: 'Inter_700Bold' },
    '.font-extrabold': { fontFamily: 'Inter_800ExtraBold' },
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
         * Unslop pass on the F-817/F-818 glass theme: cream canvas, warm-white surfaces and frosted Glass panels (see
         * components/ui/glass.tsx) stay; KBS orange is the
         * only accent and is used rarely (primary action, selection, one key figure). Token *names* stay so screens
         * keep compiling: canvas = page, surface/card = raised card, navy/ink/brand = primary text (graphite),
         * indigo/gold/orange = the accent. `gold`/`orange.strong` (#C2410C) is the fill/text shade that passes 4.5:1
         * with white; the bright #F05A28 is only for small marks (dots, bars, the selected tab).
         */
        background: '#F2EEE8',
        foreground: '#1C1917',
        canvas: '#F2EEE8',
        surface: '#FFFDFA',
        raised: '#F7F4EF',
        navy: '#1C1917',
        ink: '#1C1917',
        brand: '#1C1917',
        secondary: { DEFAULT: '#F7F4EF', foreground: '#4A433E' },
        muted: { DEFAULT: '#F7F4EF', foreground: '#6A625D' },
        subtle: '#6A625D',
        indigo: '#C2410C',
        orange: { DEFAULT: '#F05A28', strong: '#C2410C', soft: '#FDF1EC' },
        teal: { DEFAULT: '#0F766E', soft: '#E6F4F2', bright: '#0F766E' },
        gold: { DEFAULT: '#C2410C', soft: '#FDF1EC', ink: '#9A3412' },
        line: '#E7E1D8',
        border: '#E7E1D8',
      },
      // one type scale (px, line height): 12 meta · 13 caption · 14 secondary · 15 body · 17 title · 22 heading ·
      // 28 page/figure · 32 key figure. Use these instead of text-[NNpx].
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        md: ['14px', '20px'],
        base: ['15px', '22px'],
        lg: ['17px', '24px'],
        xl: ['22px', '28px'],
        '2xl': ['28px', '34px'],
        '3xl': ['32px', '38px'],
      },
      // controls 8–10, cards 12–16, sheets 16–20; pills (rounded-full) only for avatars, dots, toggles and chips
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
    },
  },
  plugins: [interWeights],
};
