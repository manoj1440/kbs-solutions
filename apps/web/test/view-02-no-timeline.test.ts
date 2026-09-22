import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** VIEW-02 / REQ-14 §14.1: no fixed progress timeline / stepper component may exist for bank status. */
const ROOTS = [join(__dirname, '../src'), join(__dirname, '../../mobile/app'), join(__dirname, '../../mobile/components')];
const FORBIDDEN = /\b(StatusTimeline|ProgressTimeline|LeadTimeline|ApplicationStepper|StageStepper|ProgressSteps)\b|Under Processing|Application Initiated/;

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('VIEW-02: no fictional progress timeline', () => {
  it('no timeline/stepper component or auto-advanced stage wording exists in web or mobile UI', () => {
    const offenders = ROOTS.flatMap((r) => walk(r)).filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
