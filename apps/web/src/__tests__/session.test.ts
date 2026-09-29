import { beforeEach, describe, expect, it } from 'vitest';
import { canDo, useSession } from '../store/session';

describe('session permissions', () => {
  beforeEach(() => useSession.setState({ permissions: {}, accessToken: null, user: null }));
  it('denies everything by default', () => {
    expect(canDo('shipments', 'r')).toBe(false);
  });
  it('evaluates module/action strings, ignoring whitespace', () => {
    useSession.setState({ permissions: { shipments: 'cru x', invoices: 'r' } });
    expect(canDo('shipments', 'c')).toBe(true);
    expect(canDo('shipments', 'x')).toBe(true);
    expect(canDo('shipments', 'd')).toBe(false);
    expect(canDo('invoices', 'u')).toBe(false);
    expect(canDo('costs', 'r')).toBe(false);
  });
  it('logout clears credentials and permissions', () => {
    useSession.setState({ accessToken: 'a', refreshToken: 'r', permissions: { x: 'r' } as any });
    useSession.getState().logout();
    expect(useSession.getState().accessToken).toBeNull();
    expect(useSession.getState().permissions).toEqual({});
  });
});
