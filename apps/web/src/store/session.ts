import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hasPermission, type Action } from '@digitalburj/shared';

export interface SessionUser { id: string; name: string; email: string; role: string; baseRole: string; customerId: string | null; locale: string }
export interface Entity { id: string; code: string; name: string; branch?: string }

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  permissions: Record<string, string>;
  tenant: { id: string; name: string; slug: string; trn?: string; currency: string } | null;
  entities: Entity[];
  entityId: string; // 'all' or an entity id
  theme: 'light' | 'dark';
  locale: 'en' | 'ar';
  collapsed: boolean;
  setTokens: (a: string, r: string) => void;
  setMe: (me: any) => void;
  set: (p: Partial<SessionState>) => void;
  logout: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null, refreshToken: null, user: null, permissions: {}, tenant: null, entities: [], entityId: 'all',
      theme: 'light', locale: 'en', collapsed: false,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setMe: (me) => set({ user: me.user, permissions: me.permissions || {}, tenant: me.tenant, entities: me.entities || [] }),
      set: (p) => set(p as any),
      logout: () => set({ accessToken: null, refreshToken: null, user: null, permissions: {}, tenant: null, entities: [] }),
    }),
    { name: 'db-session', partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user, theme: s.theme, locale: s.locale, collapsed: s.collapsed, entityId: s.entityId }) },
  ),
);

/** Non-hook permission check for use in callbacks. */
export const canDo = (module: string, action: Action): boolean => hasPermission(useSession.getState().permissions as any, module, action);

/** Hook: re-renders when permissions change. */
export function useCan() {
  const perms = useSession((s) => s.permissions);
  return (module: string, action: Action = 'r') => hasPermission(perms as any, module, action);
}
