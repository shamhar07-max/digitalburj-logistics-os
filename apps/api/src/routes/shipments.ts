import { Router } from 'express';
import { z } from 'zod';
import { defaultTaxCode, MODES, round2, SHIPMENT_TRANSITIONS, marginPct } from '@digitalburj/shared';
import { many, one, query, tx } from '../db';
import { can, requirePerm } from '../auth/middleware';
import { badRequest, forbidden, notFound, wrap } from '../lib/errors';
import { isUuid } from '../crud/validate';
import { auditFromReq } from '../services/audit';
import { publish } from '../services/events';
import { changeShipmentStatus, createShipment, refreshRisk } from '../services/shipments';
import { randomToken } from '../lib/crypto';

export const shipmentsRouter = Router();

const modeValues = MODES.map((m) => m.value) as [string, ...string[]];
const uuidOpt = z.string().uuid().nullish();

const newShipmentSchema = z.object({
  customer_id: z.string().uuid(),
  consignee_id: uuidOpt,
  mode: z.enum(modeValues),
  origin: z.string().max(120).nullish(),
  destination: z.string().max(120).nullish(),
  pol: z.string().max(120).nullish(),
  pod: z.string().max(120).nullish(),
  carrier: z.string().max(120).nullish(),
  incoterm: z.string().max(20).nullish(),
  cargo_description: z.string().max(500).nullish(),
  container_type: z.string().max(40).nullish(),
  weight_kg: z.coerce.number().min(0).nullish(),
  volume_cbm: z.coerce.number().min(0).nullish(),
  cargo_value: z.coerce.number().min(0).nullish(),
  etd: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullish(),
  eta: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullish(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  ops_owner_id: uuidOpt,
});

shipmentsRouter.post(
  '/',
  requirePerm('shipments', 'c'),
  wrap(async (req, res) => {
    const b = newShipmentSchema.parse(req.body);
    const row = await tx(async (db) => {
      const cust = await one(db, 'SELECT 1 FROM customers WHERE id=$1 AND tenant_id=$2', [b.customer_id, req.user!.tenantId]);
      if (!cust) throw badRequest('Unknown customer');
      const s = await createShipment(db, req.user!.tenantId, req.user!.id, {
        ...b, mode: b.mode as any, entity_id: req.entityId || req.user!.entityIds[0] || null,
        etd: b.etd?.slice(0, 10), eta: b.eta?.slice(0, 10),
      });
      await auditFromReq(req, 'create', 'shipment', s.id, b, db);
      return s;
    });
    res.status(201).json(row);
  }),
);

shipmentsRouter.get(
  '/stats',
  requirePerm('shipments', 'r'),
  wrap(async (req, res) => {
    const rows = await many({ query }, `SELECT status, count(*)::int AS n FROM shipments WHERE tenant_id=$1 GROUP BY status`, [req.user!.tenantId]);
    const risk = await many({ query }, `SELECT risk_level, count(*)::int AS n FROM shipments WHERE tenant_id=$1 AND status NOT IN ('closed','cancelled','invoiced') GROUP BY risk_level`, [req.user!.tenantId]);
    res.json({ byStatus: rows, byRisk: risk, transitions: SHIPMENT_TRANSITIONS });
  }),
);

/** Full shipment workspace payload for the detail screen. */
shipmentsRouter.get(
  '/:id/detail',
  requirePerm('shipments', 'r'),
  wrap(async (req, res) => {
    if (!isUuid(req.params.id)) throw notFound();
    const t = req.user!.tenantId;
    const params: any[] = [t, req.params.id];
    let portal = '';
    if (req.user!.baseRole === 'customer') {
      params.push(req.user!.customerId || '00000000-0000-0000-0000-000000000000');
      portal = ' AND (s.customer_id=$3 OR s.consignee_id=$3)';
    }
    const s = await one<any>({ query }, `SELECT s.*, (SELECT name FROM customers c WHERE c.id=s.customer_id) AS customer_name, (SELECT name FROM customers c WHERE c.id=s.consignee_id) AS consignee_name
       FROM shipments s WHERE s.tenant_id=$1 AND s.id=$2${portal}`, params);
    if (!s) throw notFound();
    const canCost = can(req, 'costs', 'r');
    const isCustomer = req.user!.baseRole === 'customer';
    const [milestones, charges, documents, customs, stops, invoices, audits] = await Promise.all([
      many({ query }, 'SELECT * FROM milestones WHERE shipment_id=$1 ORDER BY sort', [s.id]),
      isCustomer ? Promise.resolve([]) : many({ query }, `SELECT ch.*, (SELECT name FROM suppliers x WHERE x.id=ch.supplier_id) AS supplier_name FROM charges ch WHERE ch.shipment_id=$1 ${canCost ? '' : "AND ch.kind='revenue'"} ORDER BY ch.kind, ch.created_at`, [s.id]),
      many({ query }, `SELECT id, type, name, mime, size, is_public, created_at FROM documents WHERE shipment_id=$1 ${isCustomer ? 'AND is_public' : ''} ORDER BY created_at DESC`, [s.id]),
      isCustomer ? Promise.resolve([]) : many({ query }, 'SELECT * FROM customs_declarations WHERE shipment_id=$1 ORDER BY created_at DESC', [s.id]),
      isCustomer ? Promise.resolve([]) : many({ query }, `SELECT ts.*, tr.number AS trip_number, (SELECT name FROM drivers d WHERE d.id=tr.driver_id) AS driver_name FROM trip_stops ts JOIN trips tr ON tr.id=ts.trip_id WHERE ts.shipment_id=$1 ORDER BY ts.seq`, [s.id]),
      many({ query }, 'SELECT id, number, status, total, paid, due_date FROM invoices WHERE shipment_id=$1 ORDER BY issue_date DESC', [s.id]),
      isCustomer ? Promise.resolve([]) : many({ query }, `SELECT action, user_name, changes, created_at FROM audit_log WHERE tenant_id=$1 AND entity_type='shipment' AND entity_id=$2 ORDER BY created_at DESC LIMIT 50`, [t, s.id]),
    ]);
    const rev = round2((charges as any[]).filter((c) => c.kind === 'revenue').reduce((x, c) => x + Number(c.amount_aed), 0));
    const cost = canCost ? round2((charges as any[]).filter((c) => c.kind === 'cost').reduce((x, c) => x + Number(c.amount_aed), 0)) : undefined;
    res.json({
      shipment: s, milestones, charges, documents, customs, stops, invoices, timeline: audits,
      financials: { revenue: rev, cost, margin: cost === undefined ? undefined : round2(rev - cost), marginPct: cost === undefined ? undefined : marginPct(rev, cost) },
      nextStatuses: (SHIPMENT_TRANSITIONS as any)[s.status] || [],
    });
  }),
);

shipmentsRouter.post(
  '/:id/status',
  requirePerm('shipments', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ status: z.string(), note: z.string().max(500).optional() }).parse(req.body);
    const row = await tx(async (db) => {
      const r = await changeShipmentStatus(db, req.user!.tenantId, req.user!.id, req.params.id, b.status, b.note);
      await auditFromReq(req, 'status', 'shipment', r.id, { to: b.status, note: b.note }, db);
      await refreshRisk(db, req.user!.tenantId, r.id);
      return r;
    });
    res.json(row);
  }),
);

shipmentsRouter.patch(
  '/:id/milestones/:mid',
  requirePerm('shipments', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ done: z.boolean().optional(), status: z.enum(['pending', 'done', 'at_risk', 'blocked']).optional(), notes: z.string().max(500).nullish(), due_at: z.string().nullish() }).parse(req.body);
    const t = req.user!.tenantId;
    const m = await one<any>({ query }, 'SELECT * FROM milestones WHERE id=$1 AND shipment_id=$2 AND tenant_id=$3', [req.params.mid, req.params.id, t]);
    if (!m) throw notFound();
    const status = b.done === true ? 'done' : b.done === false ? 'pending' : b.status || m.status;
    const row = await one({ query }, `UPDATE milestones SET status=$2, done_at=CASE WHEN $2='done' THEN COALESCE(done_at, now()) ELSE NULL END,
        notes=COALESCE($3, notes), due_at=COALESCE($4::timestamptz, due_at) WHERE id=$1 RETURNING *`, [m.id, status, b.notes ?? null, b.due_at ?? null]);
    publish({ tenantId: t, type: 'milestone.updated', entityType: 'shipment', entityId: req.params.id, payload: { code: m.code, status }, userId: req.user!.id });
    await auditFromReq(req, 'milestone', 'shipment', req.params.id, { code: m.code, status });
    res.json(row);
  }),
);

// ── Charges (revenue + cost lines) ──
const chargeSchema = z.object({
  kind: z.enum(['revenue', 'cost']),
  charge_type: z.string().max(40).default('other'),
  description: z.string().min(1).max(200),
  supplier_id: uuidOpt,
  quantity: z.coerce.number().positive().default(1),
  unit_amount: z.coerce.number().min(0),
  currency: z.string().length(3).default('AED'),
  fx_rate: z.coerce.number().positive().default(1),
  tax_code: z.enum(['S', 'Z', 'E', 'O']).optional(),
});

shipmentsRouter.post(
  '/:id/charges',
  requirePerm('shipments', 'u'),
  wrap(async (req, res) => {
    const b = chargeSchema.parse(req.body);
    if (b.kind === 'cost' && !can(req, 'costs', 'r')) throw forbidden('Cost lines require finance/operations access');
    const s = await one<any>({ query }, 'SELECT id, status FROM shipments WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!s) throw notFound();
    if (['closed', 'cancelled'].includes(s.status)) throw badRequest('Shipment is closed');
    const amountAed = round2(b.quantity * b.unit_amount * (b.currency === 'AED' ? 1 : b.fx_rate));
    const row = await one({ query }, `INSERT INTO charges (tenant_id, shipment_id, kind, charge_type, description, supplier_id, quantity, unit_amount, currency, fx_rate, amount_aed, tax_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user!.tenantId, s.id, b.kind, b.charge_type, b.description, b.supplier_id ?? null, b.quantity, b.unit_amount, b.currency, b.currency === 'AED' ? 1 : b.fx_rate, amountAed, b.tax_code || defaultTaxCode(b.charge_type)]);
    await auditFromReq(req, 'create', 'charge', (row as any).id, b);
    res.status(201).json(row);
  }),
);

shipmentsRouter.delete(
  '/:id/charges/:cid',
  requirePerm('shipments', 'u'),
  wrap(async (req, res) => {
    const c = await one<any>({ query }, 'SELECT * FROM charges WHERE id=$1 AND shipment_id=$2 AND tenant_id=$3', [req.params.cid, req.params.id, req.user!.tenantId]);
    if (!c) throw notFound();
    if (c.invoice_id || c.bill_id) throw badRequest('Charge is already billed and cannot be deleted');
    if (c.kind === 'cost' && !can(req, 'costs', 'r')) throw forbidden();
    await query('DELETE FROM charges WHERE id=$1', [c.id]);
    await auditFromReq(req, 'delete', 'charge', c.id, c);
    res.status(204).end();
  }),
);

shipmentsRouter.post(
  '/:id/rotate-tracking-token',
  requirePerm('shipments', 'u'),
  wrap(async (req, res) => {
    const row = await one<any>({ query }, 'UPDATE shipments SET tracking_token=$3 WHERE id=$1 AND tenant_id=$2 RETURNING tracking_token', [req.params.id, req.user!.tenantId, randomToken(12)]);
    if (!row) throw notFound();
    res.json({ tracking_token: row.tracking_token });
  }),
);

shipmentsRouter.post(
  '/refresh-risk',
  requirePerm('shipments', 'u'),
  wrap(async (req, res) => {
    const n = await tx((db) => refreshRisk(db, req.user!.tenantId));
    res.json({ changed: n });
  }),
);
