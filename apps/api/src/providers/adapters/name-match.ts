/**
 * Strict name comparison shared by the Cashfree PAN and DigiLocker adapters (runbook 09).
 *
 * Rule — two names match only when, after normalisation, they contain exactly the same words:
 *   1. Unicode-normalise, drop accents, upper-case.
 *   2. Every character that is not a letter or a digit (dots, commas, hyphens, apostrophes, slashes…) becomes a space;
 *      runs of spaces collapse.
 *   3. Leading honorifics are dropped (MR, MRS, MS, MISS, DR, SHRI, SMT, SHRIMATI, KUM, KUMARI) — leading only, because
 *      e.g. KUMARI is also a real second name.
 *   4. Match when the words are the same in any order ("SHARMA RAJESH" = "Rajesh Sharma"), or when the names are equal
 *      once spaces are removed ("RAJESHKUMAR" = "Rajesh Kumar", "R.K. Sharma" = "RK Sharma").
 *
 * Deliberately NOT a match: a missing or extra word (middle name, father's name), an initial against a full word
 * ("R Sharma" vs "Rajesh Sharma"), spelling variants ("Mohd" vs "Mohammed"). No similarity score or threshold is used.
 */
const HONORIFICS = new Set([
  'MR',
  'MRS',
  'MS',
  'MISS',
  'DR',
  'SHRI',
  'SMT',
  'SHRIMATI',
  'KUM',
  'KUMARI',
]);

export function normalizeNameTokens(name: string): string[] {
  const tokens = name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (tokens.length > 1 && HONORIFICS.has(tokens[0] as string)) tokens.shift();
  return tokens;
}

export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ta = normalizeNameTokens(a);
  const tb = normalizeNameTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta.join('') === tb.join('')) return true;
  if (ta.length !== tb.length) return false;
  const sa = [...ta].sort();
  const sb = [...tb].sort();
  return sa.every((t, i) => t === sb[i]);
}
