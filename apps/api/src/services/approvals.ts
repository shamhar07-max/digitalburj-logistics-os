import { Db, many, one } from '../db';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { publish } from './events';
import { notifyPermitted, notify } from './notify';

export interface ApprovalRequest {
  tenantId: string;
  entityType: 'quote' | 'purchase' | 'payroll' | 'leave' | 'expense' | 'credit_note';
  entityId: string;
  title: string;
  summary?: string;
  amount?: number;
  priority?: 'low' | 'normal' | 'high';
  requestedBy: string;
}

export async function requestApproval(db: Db, a: ApprovalRequest) {
  // one open approval per entity
  const open = await one<any>(db, `SELECT * FROM approvals WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 AND status='pending'`, [a.tenantId, a.entityType, a.entityId]);
  if (open) return open;
  const row = (
    await db.query(`INSERT INTO approvals (tenant_id, entity_type, entity_id, title, summary, amount, priority, requested_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [
      a.tenantId, a.entityType, a.entityId, a.title, a.summary ?? null, a.amount ?? null, a.priority ?? 'normal', a.requestedBy,
    ])
  ).rows[0];
  publish({ tenantId: a.tenantId, type: 'approval.requested', entityType: 'approval', entityId: row.id, payload: { title: a.title, amount: a.amount } });
  await notifyPermitted(a.tenantId, 'approvals', 'a', { title: `Approval needed: ${a.title}`, body: a.summary, level: 'warning', link: '/approvals' }, db);
  return row;
}

type Handler = (db: Db, tenantId: string, approval: any, approved: boolean, userId: string) => Promise<void>;

const handlers: Record<string, Handler> = {
  quote: async (db, t, a, ok) => {
    await db.query(`UPDATE quotes SET status=$3 WHERE tenant_id=$1 AND id=$2 AND status='pending_approval'`, [t, a.entity_id, ok ? 'approved' : 'draft']);
  },
  purchase: async (db, t, a, ok) => {
    await db.query(`UPDATE purchases SET status=$3 WHERE tenant_id=$1 AND id=$2 AND status='pending_approval'`, [t, a.entity_id, ok ? 'approved' : 'rejected']);
  },
  payroll: async (db, t, a, ok, userId) => {
    await db.query(`UPDATE payroll_runs SET status=$3, approved_by=CASE WHEN $3='approved' THEN $4::uuid ELSE NULL END WHERE tenant_id=$1 AND id=$2 AND status='pending_approval'`, [t, a.entity_id, ok ? 'approved' : 'draft', userId]);
  },
  leave: async (db, t, a, ok) => {
    await db.query(`UPDATE leave_requests SET status=$3 WHERE tenant_id=$1 AND id=$2`, [t, a.entity_id, ok ? 'approved' : 'rejected']);
    if (ok) {
      const l = await one<any>(db, 'SELECT employee_id, from_date, to_date FROM leave_requests WHERE id=$1', [a.entity_id]);
      if (l) await db.query(`UPDATE employees SET status='on_leave' WHERE id=$1 AND $2::date <= current_date AND $3::date >= current_date`, [l.employee_id, l.from_date, l.to_date]);
    }
  },
  expense: async (db, t, a, ok) => {
    await db.query(`UPDATE driver_expenses SET status=$3 WHERE tenant_id=$1 AND id=$2`, [t, a.entity_id, ok ? 'approved' : 'rejected']);
  },
};

export async function decideApproval(db: Db, p: { tenantId: string; userId: string; userRole: string; id: string; approve: boolean; note?: string }) {
  const a = await one<any>(db, `SELECT * FROM approvals WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [p.tenantId, p.id]);
  if (!a) throw notFound('Approval not found');
  if (a.status !== 'pending') throw badRequest(`Already ${a.status}`);
  // segregation of duties: requester can't approve their own request unless they are the owner
  if (a.requested_by === p.userId && p.userRole !== 'owner') throw forbidden('You cannot approve your own request');
  await db.query(`UPDATE approvals SET status=$3, decided_by=$4, decided_at=now(), decision_note=$5 WHERE id=$1 AND tenant_id=$2`, [p.id, p.tenantId, p.approve ? 'approved' : 'rejected', p.userId, p.note ?? null]);
  const h = handlers[a.entity_type];
  if (h) await h(db, p.tenantId, a, p.approve, p.userId);
  publish({ tenantId: p.tenantId, type: p.approve ? 'approval.approved' : 'approval.rejected', entityType: a.entity_type, entityId: a.entity_id, payload: { title: a.title }, userId: p.userId });
  if (a.requested_by) await notify(p.tenantId, { userId: a.requested_by, title: `${a.title} — ${p.approve ? 'approved' : 'rejected'}`, body: p.note, level: p.approve ? 'success' : 'error' }, db);
  return { ...a, status: p.approve ? 'approved' : 'rejected' };
}

export const pendingApprovals = (db: Db, tenantId: string) =>
  many<any>(db, `SELECT a.*, (SELECT name FROM users u WHERE u.id=a.requested_by) AS requested_by_name FROM approvals a WHERE a.tenant_id=$1 AND a.status='pending' ORDER BY (a.priority='high') DESC, a.created_at`, [tenantId]);
