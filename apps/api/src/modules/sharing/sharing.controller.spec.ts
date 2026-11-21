import { SharingController } from './sharing.controller';
import type { SharingService } from './sharing.service';

describe('F-908 S10 WhatsApp delivery webhook', () => {
  const svc = { applyDelivery: jest.fn(async () => ({ updated: 1 })) } as unknown as SharingService;
  const secret = 'wa-webhook-secret-0123456789abcdef';
  const body = { providerMessageId: 'm1', status: 'DELIVERED' };

  it('SEC-12: does not exist with the hand-off provider or without a secret', () => {
    expect(() => new SharingController(svc, { WHATSAPP_WEBHOOK_TOKEN: secret }, { mode: 'HANDOFF' }).delivery(secret, body)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    expect(() => new SharingController(svc, { WHATSAPP_WEBHOOK_TOKEN: '' }, { mode: 'BUSINESS_API' }).delivery('', body)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });
  it('SEC-12: refuses a missing or wrong token and accepts the right one', async () => {
    const c = new SharingController(svc, { WHATSAPP_WEBHOOK_TOKEN: secret }, { mode: 'BUSINESS_API' });
    expect(() => c.delivery(undefined, body)).toThrow(expect.objectContaining({ code: 'AUTH_REQUIRED' }));
    expect(() => c.delivery(`${secret}x`, body)).toThrow(expect.objectContaining({ code: 'AUTH_REQUIRED' }));
    await c.delivery(secret, body);
    expect(svc.applyDelivery).toHaveBeenCalledWith('m1', 'DELIVERED');
  });
});
