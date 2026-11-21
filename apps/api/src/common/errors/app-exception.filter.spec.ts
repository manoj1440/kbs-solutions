import { describeUnknownError } from './app-exception.filter';

describe('F-908 S10 unknown errors in logs', () => {
  it('SEC-10: deployed environments log class, code and frames but never the message values', () => {
    const e = Object.assign(new Error('Unique constraint failed on value "+919876543210" for Ravi Kumar'), { name: 'PrismaClientKnownRequestError', code: 'P2002', meta: { modelName: 'User', target: ['mobile'] } });
    const logged = describeUnknownError(e, true);
    expect(logged).toMatchObject({ name: 'PrismaClientKnownRequestError', code: 'P2002', model: 'User', target: ['mobile'] });
    expect((logged.frames as string[]).length).toBeGreaterThan(0);
    expect(JSON.stringify(logged)).not.toMatch(/9876543210|Ravi/);
  });
  it('SEC-10: local development keeps the message for debugging', () => {
    expect(describeUnknownError(new Error('boom'), false)).toMatchObject({ name: 'Error', message: 'boom' });
    expect(describeUnknownError('a string', true)).toEqual({ type: 'string' });
  });
});
