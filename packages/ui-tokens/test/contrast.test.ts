import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../src/contrast';
import { palette } from '../src/tokens';

const pairs: Array<[keyof typeof palette.light, keyof typeof palette.light]> = [
  ['foreground', 'background'],
  ['primaryForeground', 'primary'],
  ['destructiveForeground', 'destructive'],
  ['successForeground', 'success'],
  ['warningForeground', 'warning'],
  ['infoForeground', 'info'],
  ['unknownForeground', 'unknown'],
  ['provenanceBankMisForeground', 'provenanceBankMis'],
  ['provenanceKbsOperationalForeground', 'provenanceKbsOperational'],
  ['provenanceKbsPaymentForeground', 'provenanceKbsPayment'],
  ['mutedForeground', 'muted'],
];

describe('WCAG AA contrast (REQ-20 §20.5)', () => {
  for (const mode of ['light', 'dark'] as const) {
    for (const [fg, bg] of pairs) {
      it(`${mode}: ${fg} on ${bg} ≥ 4.5`, () => {
        expect(contrastRatio(palette[mode][fg], palette[mode][bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
