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
        // F-818: web palette (F-817) under the F-805 names — navy/ink/brand = near-black, indigo/gold = orange accent
        canvas: '#F2EEE8',
        surface: '#FFFDFA',
        navy: '#1C1917',
        ink: '#1C1917',
        brand: '#1C1917',
        indigo: '#F05A28',
        orange: { DEFAULT: '#F05A28', strong: '#C2410C', soft: '#FDEEE6' },
        teal: { DEFAULT: '#0F766E', soft: '#E3F4F1', bright: '#2DD4BF' },
        gold: { DEFAULT: '#F05A28', soft: '#FDEEE6', ink: '#9A3412' },
        line: '#E7E1D8',
      },
      borderRadius: { ...base.borderRadius, '2xl': '20px', '3xl': '28px' },
    },
  },
  plugins: [interWeights],
};
