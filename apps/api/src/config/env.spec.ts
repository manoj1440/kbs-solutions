import { assertMasterCodeAllowed, assertProductionProviders, DEFAULT_OTP_PEPPER } from './env';

describe('F-907 master OTP by environment', () => {
  it('production refuses any master code', () => {
    expect(() => assertMasterCodeAllowed({ NODE_ENV: 'production', OTP_DEV_MASTER_CODE: '481927' })).toThrow();
    expect(() => assertMasterCodeAllowed({ NODE_ENV: 'production', OTP_DEV_MASTER_CODE: '' })).not.toThrow();
  });
  it('staging refuses guessable codes and accepts a secret one', () => {
    for (const code of ['000000', '111111', '123456']) {
      expect(() => assertMasterCodeAllowed({ NODE_ENV: 'staging', OTP_DEV_MASTER_CODE: code })).toThrow();
    }
    expect(() => assertMasterCodeAllowed({ NODE_ENV: 'staging', OTP_DEV_MASTER_CODE: '481927' })).not.toThrow();
  });
  it('development keeps 000000', () => {
    expect(() => assertMasterCodeAllowed({ NODE_ENV: 'development', OTP_DEV_MASTER_CODE: '000000' })).not.toThrow();
  });
});

describe('F-908 S8 production refuses mock providers and the default pepper', () => {
  const prod = { NODE_ENV: 'production' as const, OTP_PEPPER: 'a-real-random-pepper-value', KYC_PROVIDER: 'cashfree' as const, PAN_PROVIDER: 'cashfree' as const, TELEPHONY_PROVIDER: 'exotel' as const, STORAGE_PROVIDER: 's3' as const, SCAN_PROVIDER: 'clamav' as const };
  it('SEC-08: a fully real production config boots', () => {
    expect(() => assertProductionProviders(prod)).not.toThrow();
  });
  it.each([
    ['OTP_PEPPER', { OTP_PEPPER: DEFAULT_OTP_PEPPER }, /OTP_PEPPER/],
    ['KYC_PROVIDER', { KYC_PROVIDER: 'mock' as const }, /KYC_PROVIDER=mock/],
    ['PAN_PROVIDER', { PAN_PROVIDER: 'mock' as const }, /PAN_PROVIDER=mock/],
    ['TELEPHONY_PROVIDER', { TELEPHONY_PROVIDER: 'mock' as const }, /TELEPHONY_PROVIDER=mock/],
    ['STORAGE_PROVIDER', { STORAGE_PROVIDER: 'memory' as const }, /STORAGE_PROVIDER=memory/],
    ['SCAN_PROVIDER', { SCAN_PROVIDER: 'noop' as const }, /SCAN_PROVIDER=noop/],
  ])('SEC-08: production refuses %s', (_name, patch, msg) => {
    expect(() => assertProductionProviders({ ...prod, ...patch })).toThrow(msg);
  });
  it('SEC-08: staging and development keep running mock / noop providers and the default pepper', () => {
    const mocks = { OTP_PEPPER: DEFAULT_OTP_PEPPER, KYC_PROVIDER: 'mock' as const, PAN_PROVIDER: 'mock' as const, TELEPHONY_PROVIDER: 'mock' as const, STORAGE_PROVIDER: 'memory' as const, SCAN_PROVIDER: 'noop' as const };
    for (const NODE_ENV of ['staging', 'development', 'test'] as const) expect(() => assertProductionProviders({ ...mocks, NODE_ENV })).not.toThrow();
  });
});
