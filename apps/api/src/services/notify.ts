import { Db, query } from '../db';
import { listUsersWithPermission } from '../auth/middleware';
import type { Action } from '@digitalburj/shared';
import { publish } from './events';

export async function notify(
  tenantId: string,
  n: { userId?: string | null; title: string; body?: string; level?: 'info' | 'success' | 'warning' | 'error'; link?: string },
  db: Db = { query },
) {
  const r = await db.query(`INSERT INTO notifications (tenant_id, user_id, title, body, level, link) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [tenantId, n.userId ?? null, n.title, n.body ?? null, n.level ?? 'info', n.link ?? null]);
  publish({ tenantId, type: 'notification.created', payload: r.rows[0] });
  return r.rows[0];
}

/** Notify everyone holding module:action permission (e.g. finance when a shipment is delivered). */
export async function notifyPermitted(tenantId: string, module: string, action: Action, n: Parameters<typeof notify>[1], db: Db = { query }) {
  const ids = await listUsersWithPermission(tenantId, module, action);
  for (const id of ids) await notify(tenantId, { ...n, userId: id }, db);
}
