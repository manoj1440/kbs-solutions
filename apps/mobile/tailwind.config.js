const { nativewindTheme } = require('@kbs/ui-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: nativewindTheme('light') },
  plugins: [],
};
