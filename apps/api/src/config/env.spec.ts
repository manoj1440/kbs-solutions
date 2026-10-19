import { assertMasterCodeAllowed } from './env';

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
