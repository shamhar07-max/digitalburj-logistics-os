import { Router } from 'express';
import { z } from 'zod';
import { Db, many, nextRef, one, query, tx } from '../db';
import { requirePerm } from '../auth/middleware';
import { badRequest, conflict, notFound, wrap } from '../lib/errors';
import { auditFromReq } from '../services/audit';
import { decideApproval, pendingApprovals, requestApproval } from '../services/approvals';
import { getSettings } from '../services/settings';
import { publish } from '../services/events';

// ─────────────────────────── Warehouse ───────────────────────────
export const warehouseRouter = Router();

const receiveSchema = z.object({
  shipment_id: z.string().uuid().nullish(),
  customer_id: z.string().uuid().nullish(),
  description: z.string().min(2).max(300),
  pieces: z.coerce.number().int().min(1),
  weight_kg: z.coerce.number().min(0).nullish(),
  volume_cbm: z.coerce.number().min(0).nullish(),
  bin_id: z.string().uuid().nullish(),
  notes: z.string().max(300).nullish(),
});

async function checkBinCapacity(db: Db, tenantId: string, binId: string, addKg: number, excludeStock?: string) {
  const bin = await one<any>(db, 'SELECT * FROM warehouse_bins WHERE id=$1 AND tenant_id=$2', [binId, tenantId]);
  if (!bin) throw badRequest('Unknown bin');
  if (bin.status === 'blocked') throw conflict(`Bin ${bin.code} is blocked`);
  if (bin.capacity_kg) {
    const used = await one<any>(db, `SELECT COALESCE(SUM(weight_kg),0) AS kg FROM warehouse_stock WHERE bin_id=$1 AND status='stored' ${excludeStock ? 'AND id <> $2' : ''}`, excludeStock ? [binId, excludeStock] : [binId]);
    if (Number(used!.kg) + addKg > bin.capacity_kg) throw conflict(`Bin ${bin.code} capacity exceeded (${Math.round(Number(used!.kg) + addKg)} / ${bin.capacity_kg} kg)`);
  }
  return bin;
}

warehouseRouter.post(
  '/receive',
  requirePerm('warehouse', 'c'),
  wrap(async (req, res) => {
    const b = receiveSchema.parse(req.body);
    const row = await tx(async (db) => {
      const t = req.user!.tenantId;
      if (b.bin_id) await checkBinCapacity(db, t, b.bin_id, b.weight_kg || 0);
      const s = (await db.query(`INSERT INTO warehouse_stock (tenant_id, bin_id, shipment_id, customer_id, description, pieces, weight_kg, volume_cbm, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [t, b.bin_id ?? null, b.shipment_id ?? null, b.customer_id ?? null, b.description, b.pieces, b.weight_kg ?? null, b.volume_cbm ?? null, b.notes ?? null])).rows[0];
      await db.query(`INSERT INTO warehouse_movements (tenant_id, stock_id, kind, qty, to_bin, user_id) VALUES ($1,$2,'in',$3,$4,$5)`, [t, s.id, b.pieces, b.bin_id ?? null, req.user!.id]);
      await auditFromReq(req, 'receive', 'warehouse_stock', s.id, b, db);
      return s;
    });
    res.status(201).json(row);
  }),
);

warehouseRouter.post(
  '/stock/:id/move',
  requirePerm('warehouse', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ bin_id: z.string().uuid() }).parse(req.body);
    const row = await tx(async (db) => {
      const t = req.user!.tenantId;
      const s = await one<any>(db, `SELECT * FROM warehouse_stock WHERE id=$1 AND tenant_id=$2 AND status='stored' FOR UPDATE`, [req.params.id, t]);
      if (!s) throw notFound('Stored item not found');
      await checkBinCapacity(db, t, b.bin_id, Number(s.weight_kg || 0), s.id);
      const r = (await db.query('UPDATE warehouse_stock SET bin_id=$2 WHERE id=$1 RETURNING *', [s.id, b.bin_id])).rows[0];
      await db.query(`INSERT INTO warehouse_movements (tenant_id, stock_id, kind, from_bin, to_bin, user_id) VALUES ($1,$2,'move',$3,$4,$5)`, [t, s.id, s.bin_id, b.bin_id, req.user!.id]);
      return r;
    });
    res.json(row);
  }),
);

/** Cycle count. A different count creates a discrepancy for review. */
warehouseRouter.post(
  '/stock/:id/count',
  requirePerm('warehouse', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ counted: z.coerce.number().int().min(0), note: z.string().max(300).optional() }).parse(req.body);
    const row = await tx(async (db) => {
      const s = await one<any>(db, `SELECT * FROM warehouse_stock WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [req.params.id, req.user!.tenantId]);
      if (!s) throw notFound();
      const diff = b.counted - s.pieces;
      await db.query(`INSERT INTO warehouse_movements (tenant_id, stock_id, kind, qty, note, user_id) VALUES ($1,$2,'count',$3,$4,$5)`, [req.user!.tenantId, s.id, b.counted, b.note ?? (diff ? `Discrepancy ${diff > 0 ? '+' : ''}${diff}` : 'Matched'), req.user!.id]);
      if (diff !== 0) return (await db.query(`UPDATE warehouse_stock SET status='discrepancy', notes=$2 WHERE id=$1 RETURNING *`, [s.id, `Count ${b.counted} vs expected ${s.pieces}. ${b.note || ''}`.trim()])).rows[0];
      return s;
    });
    res.json(row);
  }),
);

warehouseRouter.post(
  '/stock/:id/release',
  requirePerm('warehouse', 'u'),
  wrap(async (req, res) => {
    const row = await one<any>({ query }, `UPDATE warehouse_stock SET status='released', released_at=now() WHERE id=$1 AND tenant_id=$2 AND status IN ('stored','picked') RETURNING *`, [req.params.id, req.user!.tenantId]);
    if (!row) throw conflict('Item is not in stock');
    await query(`INSERT INTO warehouse_movements (tenant_id, stock_id, kind, qty, user_id) VALUES ($1,$2,'out',$3,$4)`, [req.user!.tenantId, row.id, row.pieces, req.user!.id]);
    res.json(row);
  }),
);

warehouseRouter.get(
  '/utilisation',
  requirePerm('warehouse', 'r'),
  wrap(async (req, res) => {
    const rows = await many({ query }, `
      SELECT b.zone, count(*)::int AS bins, COALESCE(SUM(b.capacity_kg),0) AS capacity_kg,
             COALESCE(SUM((SELECT SUM(weight_kg) FROM warehouse_stock w WHERE w.bin_id=b.id AND w.status='stored')),0) AS used_kg
        FROM warehouse_bins b WHERE b.tenant_id=$1 GROUP BY b.zone ORDER BY b.zone`, [req.user!.tenantId]);
    res.json({ zones: rows });
  }),
);

// ─────────────────────────── Procurement ───────────────────────────
export const procurementRouter = Router();

procurementRouter.post(
  '/purchases/:id/submit',
  requirePerm('procurement', 'u'),
  wrap(async (req, res) => {
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const p = await one<any>(db, 'SELECT * FROM purchases WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, t]);
      if (!p) throw notFound();
      if (p.status !== 'draft' && p.status !== 'rejected') throw conflict(`Purchase is ${p.status}`);
      if (!p.supplier_id) throw badRequest('Select a supplier first');
      const s = await getSettings(db, t);
      if (Number(p.amount) < s.po_approval_threshold) {
        await db.query(`UPDATE purchases SET status='approved' WHERE id=$1`, [p.id]);
        return { status: 'approved' };
      }
      const a = await requestApproval(db, { tenantId: t, entityType: 'purchase', entityId: p.id, title: `${p.number} — ${p.description}`.slice(0, 120), summary: `AED ${Number(p.amount).toLocaleString()}`, amount: p.amount, requestedBy: req.user!.id, priority: Number(p.amount) > s.po_approval_threshold * 5 ? 'high' : 'normal' });
      await db.query(`UPDATE purchases SET status='pending_approval', approval_id=$2 WHERE id=$1`, [p.id, a.id]);
      return { status: 'pending_approval', approval: a };
    });
    res.json(out);
  }),
);

/** Approved PR -> PO (new PO number, sent to the supplier). */
procurementRouter.post(
  '/purchases/:id/order',
  requirePerm('procurement', 'u'),
  wrap(async (req, res) => {
    const row = await tx(async (db) => {
      const t = req.user!.tenantId;
      const p = await one<any>(db, `SELECT * FROM purchases WHERE id=$1 AND tenant_id=$2 AND status='approved' FOR UPDATE`, [req.params.id, t]);
      if (!p) throw conflict('Only approved requests can be ordered');
      const number = p.kind === 'PO' ? p.number : await nextRef(db, t, 'po', 'PO-', 4, 0);
      return (await db.query(`UPDATE purchases SET kind='PO', number=$2, status='ordered' WHERE id=$1 RETURNING *`, [p.id, number])).rows[0];
    });
    res.json(row);
  }),
);

procurementRouter.post(
  '/purchases/:id/receive',
  requirePerm('procurement', 'u'),
  wrap(async (req, res) => {
    const row = await one({ query }, `UPDATE purchases SET status='received' WHERE id=$1 AND tenant_id=$2 AND status='ordered' RETURNING *`, [req.params.id, req.user!.tenantId]);
    if (!row) throw conflict('Only ordered purchases can be received');
    res.json(row);
  }),
);

// ─────────────────────────── Approvals ───────────────────────────
export const approvalsRouter = Router();

approvalsRouter.get(
  '/',
  requirePerm('approvals', 'r'),
  wrap(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    if (status === 'pending') return res.json({ data: await pendingApprovals({ query }, req.user!.tenantId) });
    res.json({ data: await many({ query }, `SELECT a.*, (SELECT name FROM users u WHERE u.id=a.requested_by) AS requested_by_name, (SELECT name FROM users u WHERE u.id=a.decided_by) AS decided_by_name FROM approvals a WHERE a.tenant_id=$1 AND a.status <> 'pending' ORDER BY a.decided_at DESC NULLS LAST LIMIT 100`, [req.user!.tenantId]) });
  }),
);

approvalsRouter.post(
  '/:id/decide',
  requirePerm('approvals', 'a'),
  wrap(async (req, res) => {
    const b = z.object({ approve: z.boolean(), note: z.string().max(500).optional() }).parse(req.body);
    const row = await tx(async (db) => {
      const r = await decideApproval(db, { tenantId: req.user!.tenantId, userId: req.user!.id, userRole: req.user!.baseRole, id: req.params.id, approve: b.approve, note: b.note });
      await auditFromReq(req, b.approve ? 'approve' : 'reject', 'approval', r.id, { title: r.title, note: b.note }, db);
      return r;
    });
    res.json(row);
  }),
);

/** Kanban move for deals (stage + position). */
export const pipelineRouter = Router();
pipelineRouter.post(
  '/deals/:id/move',
  requirePerm('pipeline', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ stage: z.enum(['lead', 'qualified', 'quoted', 'negotiation', 'won', 'lost']), position: z.coerce.number().int().min(0).default(0), lost_reason: z.string().max(300).optional() }).parse(req.body);
    const P: Record<string, number> = { lead: 10, qualified: 30, quoted: 50, negotiation: 75, won: 100, lost: 0 };
    if (b.stage === 'lost' && !b.lost_reason) throw badRequest('Please record why the deal was lost');
    const row = await tx(async (db) => {
      const d = await one<any>(db, 'SELECT * FROM deals WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, req.user!.tenantId]);
      if (!d) throw notFound();
      await db.query(`UPDATE deals SET position = position + 1 WHERE tenant_id=$1 AND stage=$2 AND position >= $3 AND id <> $4`, [req.user!.tenantId, b.stage, b.position, d.id]);
      const r = (await db.query(`UPDATE deals SET stage=$2, position=$3, probability=$4, lost_reason=CASE WHEN $2='lost' THEN $5 ELSE NULL END WHERE id=$1 RETURNING *`, [d.id, b.stage, b.position, P[b.stage], b.lost_reason ?? null])).rows[0];
      if (d.stage !== b.stage) await auditFromReq(req, 'move', 'deal', d.id, { from: d.stage, to: b.stage }, db);
      return r;
    });
    publish({ tenantId: req.user!.tenantId, type: 'deal.moved', entityType: 'deal', entityId: row.id, payload: { stage: row.stage }, userId: req.user!.id });
    res.json(row);
  }),
);

pipelineRouter.get(
  '/summary',
  requirePerm('pipeline', 'r'),
  wrap(async (req, res) => {
    const t = req.user!.tenantId;
    const [stages, won, lost, sources] = await Promise.all([
      many({ query }, `SELECT stage, count(*)::int AS n, COALESCE(SUM(value),0) AS value FROM deals WHERE tenant_id=$1 GROUP BY stage`, [t]),
      one<any>({ query }, `SELECT count(*)::int AS n, COALESCE(SUM(value),0) AS value FROM deals WHERE tenant_id=$1 AND stage='won' AND updated_at >= date_trunc('month', now())`, [t]),
      one<any>({ query }, `SELECT count(*)::int AS n FROM deals WHERE tenant_id=$1 AND stage='lost' AND updated_at >= date_trunc('month', now())`, [t]),
      many({ query }, `SELECT COALESCE(source,'unknown') AS source, count(*)::int AS deals, count(*) FILTER (WHERE stage='won')::int AS won, COALESCE(SUM(value) FILTER (WHERE stage='won'),0) AS won_value FROM deals WHERE tenant_id=$1 GROUP BY 1 ORDER BY won_value DESC`, [t]),
    ]);
    const open = (stages as any[]).filter((s) => !['won', 'lost'].includes(s.stage));
    res.json({
      stages, sources, wonThisMonth: won, pipelineValue: open.reduce((x, s) => x + Number(s.value), 0), openDeals: open.reduce((x, s) => x + s.n, 0),
      winRatePct: won!.n + lost!.n ? Math.round((won!.n / (won!.n + lost!.n)) * 100) : 0,
    });
  }),
);
