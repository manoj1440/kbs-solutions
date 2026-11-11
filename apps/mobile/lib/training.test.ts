import { describe, expect, it, vi } from 'vitest';

import { averageRetakeNotice } from './training';

// hoisted by vitest: the helper under test is pure, the API client is not needed
vi.mock('./api', () => ({ api: {} }));

describe('averageRetakeNotice (average pass rule)', () => {
  it('is null when the flag is absent or false, so the default rule is unchanged', () => {
    expect(averageRetakeNotice(null)).toBeNull();
    expect(averageRetakeNotice({})).toBeNull();
    expect(
      averageRetakeNotice({
        canRetakeForAverage: false,
        averageScorePct: 60,
        requiredAveragePct: 70,
      }),
    ).toBeNull();
  });

  it('states the average and the required average', () => {
    expect(
      averageRetakeNotice({
        canRetakeForAverage: true,
        averageScorePct: 66,
        requiredAveragePct: 70,
      }),
    ).toBe(
      'All modules passed, but your average is 66% — 70% is needed. Retake a module to raise it.',
    );
  });

  it('never rounds an average just under the mark up to the mark', () => {
    expect(
      averageRetakeNotice({
        canRetakeForAverage: true,
        averageScorePct: 69.97,
        requiredAveragePct: 70,
      }),
    ).toContain('your average is 69.9% — 70% is needed');
  });

  it('falls back to wording without numbers when they are missing', () => {
    expect(averageRetakeNotice({ canRetakeForAverage: true, requiredAveragePct: null })).toBe(
      'All modules passed, but your average is below the required average. Retake a module to raise it.',
    );
  });
});
