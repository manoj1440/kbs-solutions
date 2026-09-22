const { nativewindTheme } = require('@kbs/ui-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      ...nativewindTheme('light'),
      colors: {
        ...nativewindTheme('light').colors,
        navy: '#0A1E42',
        brand: '#16329E',
      },
    },
  },
  plugins: [],
};
