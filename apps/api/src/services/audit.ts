import type { Request } from 'express';
import { Db, query } from '../db';
import { logger } from '../logger';

const SENSITIVE = /(password|token|secret|signature|iban)/i;
function scrub(v: any): any {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(scrub);
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, SENSITIVE.test(k) ? '[redacted]' : scrub(val)]));
}

export interface AuditInput {
  tenantId: string;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: any;
  ip?: string;
}

export async function audit(input: AuditInput, db: Db = { query }) {
  try {
    await db.query(
      `INSERT INTO audit_log (tenant_id, user_id, user_name, action, entity_type, entity_id, changes, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [input.tenantId, input.userId ?? null, input.userName ?? null, input.action, input.entityType ?? null, input.entityId ?? null, input.changes ? JSON.stringify(scrub(input.changes)) : null, input.ip ?? null],
    );
  } catch (err) {
    // Auditing must never take down a business operation, but it must be visible in logs.
    logger.error({ err, input }, 'audit write failed');
  }
}

export const auditFromReq = (req: Request, action: string, entityType?: string, entityId?: string, changes?: any, db?: Db) =>
  audit(
    { tenantId: req.user!.tenantId, userId: req.user!.id, userName: req.user!.name, action, entityType, entityId, changes, ip: req.ip },
    db,
  );
