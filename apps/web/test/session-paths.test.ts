import { describe, expect, it } from 'vitest';

import { loginReason, loginUrlFor, nextForRole, safeNext } from '../src/lib/session-paths';

describe('F-804 session paths', () => {
  it('safeNext keeps same-site paths only', () => {
    expect(safeNext('/admin/leads?page=2')).toBe('/admin/leads?page=2');
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '', null, undefined, '/x\nSet-Cookie:a']) expect(safeNext(bad)).toBe('/');
  });
  it('nextForRole only returns into the user’s own area', () => {
    expect(nextForRole('/admin/mis', 'ADMIN')).toBe('/admin/mis');
    expect(nextForRole('/admin/mis', 'MANAGER')).toBe('/manager');
    expect(nextForRole('/accounts?queue=paid', 'ACCOUNTS')).toBe('/accounts?queue=paid');
    expect(nextForRole('/administrator', 'ADMIN')).toBe('/admin');
    expect(nextForRole('//evil.example', 'ADMIN')).toBe('/admin');
    expect(nextForRole('/manager', 'ADVISOR')).toBe('/access-denied');
  });
  it('maps refresh failures to login reasons', () => {
    expect(loginUrlFor('AUTH_SESSION_REVOKED', '/admin/leads')).toBe('/login?reason=session-expired&next=%2Fadmin%2Fleads');
    expect(loginUrlFor('AUTH_ACCOUNT_DEACTIVATED', '/manager')).toBe('/login?reason=deactivated&next=%2Fmanager');
    expect(loginUrlFor('AUTH_INVALID_TOKEN', '/')).toBe('/login?reason=required');
    expect(loginUrlFor(null, '//evil')).toBe('/login?reason=required');
    expect(loginReason('deactivated')).toBe('deactivated');
    expect(loginReason('<script>')).toBeNull();
  });
});
