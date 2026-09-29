import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { hasPermission, PERMISSION_MATRIX, type Action, type PermissionSet, type Role } from '@digitalburj/shared';
import { config } from '../config';
import { many, one, query } from '../db';
import { forbidden, unauthorized, wrap } from '../lib/errors';

export interface AuthUser {
  id: string;
  tenantId: string;
  role: string; // may be a custom role key
  baseRole: Role;
  name: string;
  email: string;
  customerId: string | null;
  supplierId: string | null;
  entityIds: string[];
  permissions: PermissionSet;
  locale: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      entityId?: string | null; // active legal entity (null = consolidated)
      rawBody?: Buffer;
    }
  }
}

export interface AccessClaims {
  sub: string;
  tid: string;
  typ: 'access';
}

export const signAccess = (userId: string, tenantId: string) =>
  jwt.sign({ sub: userId, tid: tenantId, typ: 'access' } as AccessClaims, config.JWT_SECRET, { expiresIn: config.ACCESS_TOKEN_TTL as any, issuer: 'digitalburj' });

export function verifyAccess(token: string): AccessClaims {
  const c = jwt.verify(token, config.JWT_SECRET, { issuer: 'digitalburj' }) as any;
  if (c.typ !== 'access') throw new Error('wrong token type');
  return c;
}

// Small TTL cache for custom role permission sets
const roleCache = new Map<string, { at: number; perms: PermissionSet; base: Role }>();
export const clearRoleCache = () => roleCache.clear();

async function resolveRole(tenantId: string, roleKey: string): Promise<{ perms: PermissionSet; base: Role }> {
  const ck = tenantId + ':' + roleKey;
  const hit = roleCache.get(ck);
  if (hit && Date.now() - hit.at < 30_000) return { perms: hit.perms, base: hit.base };
  const r = await one<{ permissions: PermissionSet; base_role: Role }>({ query }, 'SELECT permissions, base_role FROM roles WHERE tenant_id=$1 AND key=$2', [tenantId, roleKey]);
  const base = (r?.base_role || roleKey) as Role;
  const perms: PermissionSet = r && r.permissions && Object.keys(r.permissions).length ? r.permissions : PERMISSION_MATRIX[base] || {};
  roleCache.set(ck, { at: Date.now(), perms, base });
  return { perms, base };
}

/** Authenticate bearer token, load user + effective permissions, resolve active entity. */
export const authenticate = wrap(async (req: Request, _res: Response, next: NextFunction) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : (req.query.access_token as string | undefined);
  if (!token) throw unauthorized();
  let claims: AccessClaims;
  try {
    claims = verifyAccess(token);
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  const u = await one<any>({ query }, 'SELECT * FROM users WHERE id=$1 AND tenant_id=$2', [claims.sub, claims.tid]);
  if (!u || !u.is_active) throw unauthorized('Account disabled');
  const { perms, base } = await resolveRole(u.tenant_id, u.role);
  req.user = {
    id: u.id,
    tenantId: u.tenant_id,
    role: u.role,
    baseRole: base,
    name: u.name,
    email: u.email,
    customerId: u.customer_id,
    supplierId: u.supplier_id,
    entityIds: u.entity_ids || [],
    permissions: perms,
    locale: u.locale,
  };
  const hdr = req.headers['x-entity-id'];
  const ent = Array.isArray(hdr) ? hdr[0] : hdr;
  req.entityId = ent && ent !== 'all' ? ent : null;
  if (req.entityId && req.user.entityIds.length && !req.user.entityIds.includes(req.entityId) && !['owner', 'admin'].includes(base)) {
    throw forbidden('No access to that entity');
  }
  next();
});

export const can = (req: Request, module: string, action: Action) => !!req.user && hasPermission(req.user.permissions, module, action);

/** Route guard: require permission `action` on `module`. */
export const requirePerm = (module: string, action: Action) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (!hasPermission(req.user.permissions, module, action)) return next(forbidden(`Missing permission: ${module}:${action}`));
  next();
};

export const requireRole = (...roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.baseRole)) return next(forbidden());
  next();
};

/** Customer-portal users may only see their own customer's data. Returns customer id or null for staff. */
export const portalScope = (req: Request): string | null => (req.user && ['customer'].includes(req.user.baseRole) ? req.user.customerId || '00000000-0000-0000-0000-000000000000' : null);

export async function listUsersWithPermission(tenantId: string, module: string, action: Action) {
  const users = await many<any>({ query }, 'SELECT id, role FROM users WHERE tenant_id=$1 AND is_active', [tenantId]);
  const out: string[] = [];
  for (const u of users) {
    const { perms } = await resolveRole(tenantId, u.role);
    if (hasPermission(perms, module, action)) out.push(u.id);
  }
  return out;
}
