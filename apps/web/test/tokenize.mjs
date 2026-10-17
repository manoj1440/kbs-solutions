// F-814 dev codemod: neutral Tailwind colours (slate/white) → web tokens from globals.css.
// Usage: node test/tokenize.mjs <file...>   — rewrites in place, prints what it could not map.
// Variant prefixes (hover:, md:, placeholder:) are kept because only the utility part is replaced.
import { readFileSync, writeFileSync } from 'node:fs';

const shade = (s) => Number(s);
const map = [
  [/\bbg-white\b(?!\/)/g, () => 'bg-card'],
  [/\bbg-slate-(50)(?:\/\d+)?\b/g, () => 'bg-surface-muted'],
  [/\bbg-slate-(100)(?:\/\d+)?\b/g, () => 'bg-muted'],
  [/\bbg-slate-(200)(?:\/\d+)?\b/g, () => 'bg-surface-strong'],
  [/\btext-slate-(\d+)\b(?!\/)/g, (_, n) =>
    shade(n) >= 800 ? 'text-foreground' : shade(n) >= 600 ? 'text-fg-2' : shade(n) === 500 ? 'text-muted-foreground' : shade(n) >= 300 ? 'text-fg-3' : null],
  [/\btext-\[(\d+(?:\.\d+)?)px\]/g, (_, px) => (+px >= 10 && +px < 12 ? 'text-2xs' : +px >= 12 && +px < 13 ? 'text-xs' : +px >= 13 && +px < 14 ? 'text-ui' : null)],
  [/\b(border|ring|divide)-slate-(\d+)(?:\/\d+)?\b/g, (_, k, n) =>
    shade(n) <= 100 ? `${k}-border-subtle` : shade(n) === 200 ? `${k}-border` : shade(n) <= 400 ? `${k}-border-strong` : null],
];

for (const file of process.argv.slice(2)) {
  let src = readFileSync(file, 'utf8');
  let changed = 0;
  for (const [re, fn] of map) {
    src = src.replace(re, (m, ...g) => {
      const to = fn(m, ...g);
      if (!to) return m;
      changed++;
      return to;
    });
  }
  const left = [...new Set(src.match(/\b(?:bg|text|border|ring|divide)-(?:slate-\d+|white)(?:\/\d+)?\b|text-\[\d+(?:\.\d+)?px\]|#[0-9a-fA-F]{6}\b/g) ?? [])];
  writeFileSync(file, src);
  console.log(`${file}: ${changed} mapped${left.length ? ` · left: ${left.join(' ')}` : ''}`);
}
