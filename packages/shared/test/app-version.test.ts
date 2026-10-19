import { describe, expect, it } from 'vitest';

import { appUpdateState, compareVersions } from '../src/app-version';

describe('F-819 app version policy', () => {
  it('compares dotted versions numerically', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBe(1);
    expect(compareVersions('0.1.0', '0.1')).toBe(0);
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1);
    expect(compareVersions(' 2.0.0 ', '2.0.0')).toBe(0);
    expect(compareVersions('abc', '0.0.0')).toBe(0);
  });

  it('required below min, available below latest, otherwise current', () => {
    const p = { minVersion: '0.2.0', latestVersion: '0.3.0', downloadUrl: 'https://x' };
    expect(appUpdateState('0.1.0', p)).toBe('required');
    expect(appUpdateState('0.2.0', p)).toBe('available');
    expect(appUpdateState('0.3.0', p)).toBe('current');
    expect(appUpdateState('1.0.0', p)).toBe('current');
  });

  it('unset policy never blocks', () => {
    expect(appUpdateState('0.1.0', null)).toBe('current');
    expect(appUpdateState('0.1.0', { minVersion: null, latestVersion: null, downloadUrl: null })).toBe('current');
    expect(appUpdateState('0.1.0', { minVersion: '0.0.0', latestVersion: null, downloadUrl: null })).toBe('current');
  });
});
