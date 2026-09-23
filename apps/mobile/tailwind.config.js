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
        canvas: '#F4F6FB',
        navy: '#0A1E42',
        ink: '#0B1533',
        brand: '#16329E',
        indigo: '#3D5AFE',
        gold: { DEFAULT: '#F5B942', soft: '#FFF4DB', ink: '#7A4F00' },
        line: '#E6EAF2',
      },
      borderRadius: { ...base.borderRadius, '2xl': '20px', '3xl': '28px' },
    },
  },
  plugins: [interWeights],
};
