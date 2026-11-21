import { loggableQuery, loggableUrl } from './log-url';

describe('F-908 S6 request URLs in logs', () => {
  it('SEC-06: redacts the Exotel webhook token and keeps the path', () => {
    expect(loggableUrl('/api/v1/webhooks/telephony/exotel?token=s3cret-value')).toBe('/api/v1/webhooks/telephony/exotel?token=%5Bredacted%5D');
    expect(loggableUrl('/api/v1/webhooks/telephony/exotel?token=s3cret-value')).not.toContain('s3cret');
    expect(loggableQuery({ token: 's3cret', page: '2' })).toEqual({ token: '[redacted]', page: '2' });
  });
  it('SEC-06: leaves ordinary URLs alone', () => {
    expect(loggableUrl('/api/v1/leads?page=2&pageSize=20')).toBe('/api/v1/leads?page=2&pageSize=20');
    expect(loggableUrl('/api/v1/health')).toBe('/api/v1/health');
  });
});
