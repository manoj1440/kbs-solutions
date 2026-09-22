import { palette, radius } from './tokens';

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export function cssVariables(): string {
  const light = Object.entries(palette.light)
    .map(([k, v]) => `  --${kebab(k)}: ${v};`)
    .join('\n');
  const dark = Object.entries(palette.dark)
    .map(([k, v]) => `  --${kebab(k)}: ${v};`)
    .join('\n');
  return `:root {\n${light}\n  --radius: ${radius.md}px;\n}\n.dark {\n${dark}\n}\n`;
}
