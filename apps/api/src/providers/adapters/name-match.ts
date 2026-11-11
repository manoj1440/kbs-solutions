/**
 * Name comparison shared by the Cashfree PAN and DigiLocker adapters (runbook 09).
 *
 * Why it is not exact-only: the person is already authenticated by the provider (their own DigiLocker, or the PAN
 * record itself); this is a consistency check between what was typed in KBS and the document. Indian documents often
 * carry a middle or father's name, or an initial, that people leave out — rejecting those would block genuine users and
 * cost a paid re-verification each time. It still refuses anything that could be a different person.
 *
 * Normalisation:
 *   1. Unicode-normalise, drop accents, upper-case.
 *   2. Every character that is not a letter or a digit (dots, commas, hyphens, apostrophes, slashes…) becomes a space;
 *      runs of spaces collapse.
 *   3. Leading honorifics are dropped (MR, MRS, MS, MISS, DR, SHRI, SMT, SHRIMATI, KUM, KUMARI) — leading only, because
 *      e.g. KUMARI is also a real second name.
 *
 * Match when ANY of:
 *   a. the words are the same in any order ("SHARMA RAJESH" = "Rajesh Sharma");
 *   b. the names are equal once spaces are removed ("RAJESHKUMAR" = "Rajesh Kumar", "R.K. Sharma" = "RK Sharma");
 *   c. every word of the shorter name is found in the longer one — a one-letter word may stand for a word starting with
 *      that letter — AND at least two full words (2+ letters) agree exactly. So "Rajesh Sharma" = "Rajesh Kumar Sharma"
 *      and "Rajesh K Sharma" = "Rajesh Kumar Sharma".
 *
 * Deliberately NOT a match: only one full word in common ("Rajesh" vs "Rajesh Sharma", "R Sharma" vs "Rajesh Sharma"),
 * a word of the shorter name missing from the longer one, spelling variants ("Mohd" vs "Mohammed"), a different word
 * ("Rajesh" vs "Rakesh"). No similarity score or threshold is used.
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
  if (ta.length === tb.length) {
    const sa = [...ta].sort();
    const sb = [...tb].sort();
    if (sa.every((t, i) => t === sb[i])) return true;
  }
  return coveredBy(ta.length <= tb.length ? ta : tb, ta.length <= tb.length ? tb : ta);
}

/** Rule (c): every word of `short` pairs with a distinct word of `long`; initials may expand; two full words must agree. */
function coveredBy(short: string[], long: string[]): boolean {
  const free = [...long];
  const take = (pred: (candidate: string) => boolean): boolean => {
    const i = free.findIndex(pred);
    if (i < 0) return false;
    free.splice(i, 1);
    return true;
  };
  let fullAgree = 0;
  const pending: string[] = [];
  // exact pairs first, so an initial never steals the word a full name needs
  for (const w of short) {
    if (take((c) => c === w)) {
      if (w.length >= 2) fullAgree += 1;
    } else pending.push(w);
  }
  for (const w of pending) {
    const ok =
      w.length === 1
        ? take((c) => c.startsWith(w))
        : take((c) => c.length === 1 && w.startsWith(c));
    if (!ok) return false;
  }
  return fullAgree >= 2;
}
