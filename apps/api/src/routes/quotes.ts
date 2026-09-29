import { Router } from 'express';
import { z } from 'zod';
import { calcTotals, defaultTaxCode, marginPct, MODES, QUOTE_TRANSITIONS, round2 } from '@digitalburj/shared';
import { Db, many, nextRef, one, query, tx } from '../db';
import { can, portalScope, requirePerm } from '../auth/middleware';
import { badRequest, conflict, forbidden, notFound, wrap } from '../lib/errors';
import { isUuid } from '../crud/validate';
import { auditFromReq } from '../services/audit';
import { requestApproval } from '../services/approvals';
import { publish } from '../services/events';
import { getSettings } from '../services/settings';
import { chargesFromQuote, createShipment } from '../services/shipments';
import { notifyPermitted } from '../services/notify';

export const quotesRouter = Router();

const modeValues = MODES.map((m) => m.value) as [string, ...string[]];

const itemSchema = z.object({
  rate_id: z.string().uuid().nullish(),
  charge_type: z.string().max(40).default('freight'),
  description: z.string().min(1).max(200),
  quantity: z.coerce.number().positive().default(1),
  unit_price: z.coerce.number().min(0),
  unit_cost: z.coerce.number().min(0).optional(),
  tax_code: z.enum(['S', 'Z', 'E', 'O']).optional(),
  supplier_id: z.string().uuid().nullish(),
});

const quoteSchema = z.object({
  customer_id: z.string().uuid(),
  deal_id: z.string().uuid().nullish(),
  mode: z.enum(modeValues),
  origin: z.string().max(120).nullish(),
  destination: z.string().max(120).nullish(),
  incoterm: z.string().max(20).nullish(),
  cargo_description: z.string().max(500).nullish(),
  weight_kg: z.coerce.number().min(0).nullish(),
  volume_cbm: z.coerce.number().min(0).nullish(),
  containers: z.string().max(120).nullish(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullish(),
  terms: z.string().max(4000).nullish(),
  notes: z.string().max(2000).nullish(),
  items: z.array(itemSchema).min(1, 'Add at least one charge line'),
});

async function priceItems(db: Db, tenantId: string, canSetCost: boolean, items: z.infer<typeof itemSchema>[]) {
  const out: any[] = [];
  for (const [i, it] of items.entries()) {
    let cost = canSetCost ? it.unit_cost ?? 0 : 0;
    let supplier = it.supplier_id ?? null;
    if (it.rate_id) {
      const r = await one<any>(db, 'SELECT buy_rate, supplier_id FROM rates WHERE id=$1 AND tenant_id=$2', [it.rate_id, tenantId]);
      if (!r) throw badRequest(`Rate not found for line ${i + 1}`);
      cost = Number(r.buy_rate); // server-side only; sales never see it
      supplier = r.supplier_id;
    }
    out.push({ ...it, unit_cost: cost, supplier_id: supplier, tax_code: it.tax_code || defaultTaxCode(it.charge_type), sort: i });
  }
  return out;
}

function totals(items: any[]) {
  const t = calcTotals(items.map((i) => ({ quantity: i.quantity, unit_price: i.unit_price, tax_code: i.tax_code })));
  const cost = round2(items.reduce((s, i) => s + i.quantity * i.unit_cost, 0));
  return { subtotal: t.subtotal, vat: t.vat, total: t.total, cost_total: cost, margin_pct: marginPct(t.subtotal, cost) };
}

const strip = (req: any, q: any) => {
  if (can(req, 'costs', 'r')) return q;
  const { cost_total, margin_pct, ...rest } = q;
  return rest;
};

quotesRouter.get(
  '/',
  requirePerm('quotes', 'r'),
  wrap(async (req, res) => {
    const params: any[] = [req.user!.tenantId];
    const where = ['q.tenant_id=$1'];
    const push = (v: any) => (params.push(v), '$' + params.length);
    const cust = portalScope(req);
    if (cust) where.push(`q.customer_id=${push(cust)}`, `q.status <> 'draft'`);
    if (req.entityId) where.push(`(q.entity_id=${push(req.entityId)} OR q.entity_id IS NULL)`);
    const { status, customer_id, search } = req.query as Record<string, string>;
    if (status) where.push(`q.status = ANY(${push(status.split(','))}::text[])`);
    if (customer_id && isUuid(customer_id)) where.push(`q.customer_id=${push(customer_id)}`);
    if (search) where.push(`(q.number ILIKE ${push('%' + search.replace(/[\\%_]/g, '\\$&') + '%')})`);
    const rows = await many<any>({ query }, `SELECT q.*, (SELECT name FROM customers c WHERE c.id=q.customer_id) AS customer_name FROM quotes q WHERE ${where.join(' AND ')} ORDER BY q.created_at DESC LIMIT 500`, params);
    res.json({ data: rows.map((r) => strip(req, r)), total: rows.length });
  }),
);

async function loadQuote(req: any, id: string) {
  if (!isUuid(id)) throw notFound();
  const params: any[] = [req.user.tenantId, id];
  let extra = '';
  const cust = portalScope(req);
  if (cust) {
    params.push(cust);
    extra = ` AND q.customer_id=$3 AND q.status <> 'draft'`;
  }
  const q = await one<any>({ query }, `SELECT q.*, (SELECT name FROM customers c WHERE c.id=q.customer_id) AS customer_name FROM quotes q WHERE q.tenant_id=$1 AND q.id=$2${extra}`, params);
  if (!q) throw notFound();
  const items = await many<any>({ query }, 'SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY sort', [id]);
  const canCost = can(req, 'costs', 'r');
  return { ...strip(req, q), items: items.map((i) => (canCost ? i : (({ unit_cost, supplier_id, ...r }) => r)(i))) };
}

quotesRouter.get('/:id', requirePerm('quotes', 'r'), wrap(async (req, res) => res.json(await loadQuote(req, req.params.id))));

quotesRouter.post(
  '/',
  requirePerm('quotes', 'c'),
  wrap(async (req, res) => {
    const b = quoteSchema.parse(req.body);
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      if (!(await one(db, 'SELECT 1 FROM customers WHERE id=$1 AND tenant_id=$2', [b.customer_id, t]))) throw badRequest('Unknown customer');
      const items = await priceItems(db, t, can(req, 'costs', 'r'), b.items);
      const tot = totals(items);
      const number = await nextRef(db, t, 'quote', 'Q-', 0, 2200);
      const q = (
        await db.query(
          `INSERT INTO quotes (tenant_id, entity_id, number, customer_id, deal_id, mode, origin, destination, incoterm, cargo_description, weight_kg, volume_cbm, containers,
                               subtotal, vat, total, cost_total, margin_pct, valid_until, terms, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,COALESCE($19::date, current_date + 14),$20,$21,$22) RETURNING *`,
          [t, req.entityId || req.user!.entityIds[0] || null, number, b.customer_id, b.deal_id ?? null, b.mode, b.origin ?? null, b.destination ?? null, b.incoterm ?? null, b.cargo_description ?? null,
            b.weight_kg ?? null, b.volume_cbm ?? null, b.containers ?? null, tot.subtotal, tot.vat, tot.total, tot.cost_total, tot.margin_pct, b.valid_until?.slice(0, 10) ?? null, b.terms ?? null, b.notes ?? null, req.user!.id],
        )
      ).rows[0];
      for (const it of items) {
        await db.query(`INSERT INTO quote_items (tenant_id, quote_id, charge_type, description, quantity, unit_price, unit_cost, tax_code, supplier_id, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
          t, q.id, it.charge_type, it.description, it.quantity, it.unit_price, it.unit_cost, it.tax_code, it.supplier_id, it.sort,
        ]);
      }
      if (b.deal_id) await db.query(`UPDATE deals SET stage='quoted', quote_id=$2, probability=50, value=$3 WHERE id=$1 AND tenant_id=$4 AND stage IN ('lead','qualified')`, [b.deal_id, q.id, tot.total, t]);
      await auditFromReq(req, 'create', 'quote', q.id, { number, total: tot.total }, db);
      return q;
    });
    res.status(201).json(await loadQuote(req, out.id));
  }),
);

quotesRouter.put(
  '/:id',
  requirePerm('quotes', 'u'),
  wrap(async (req, res) => {
    const b = quoteSchema.parse(req.body);
    await tx(async (db) => {
      const t = req.user!.tenantId;
      const q = await one<any>(db, 'SELECT * FROM quotes WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, t]);
      if (!q) throw notFound();
      if (!['draft', 'approved', 'pending_approval'].includes(q.status)) throw conflict(`A ${q.status} quote cannot be edited. Revise it back to draft first.`);
      const canCost = can(req, 'costs', 'r');
      const items = await priceItems(db, t, canCost, b.items);
      // sales cannot set costs: keep prior cost per line index when they edit
      if (!canCost) {
        const prev = await many<any>(db, 'SELECT unit_cost, supplier_id FROM quote_items WHERE quote_id=$1 ORDER BY sort', [q.id]);
        items.forEach((it, i) => {
          if (!b.items[i].rate_id && prev[i]) {
            it.unit_cost = prev[i].unit_cost;
            it.supplier_id = prev[i].supplier_id;
          }
        });
      }
      const tot = totals(items);
      await db.query(
        `UPDATE quotes SET customer_id=$3, deal_id=$4, mode=$5, origin=$6, destination=$7, incoterm=$8, cargo_description=$9, weight_kg=$10, volume_cbm=$11, containers=$12,
                subtotal=$13, vat=$14, total=$15, cost_total=$16, margin_pct=$17, valid_until=COALESCE($18::date, valid_until), terms=$19, notes=$20, status='draft'
          WHERE id=$1 AND tenant_id=$2`,
        [q.id, t, b.customer_id, b.deal_id ?? null, b.mode, b.origin ?? null, b.destination ?? null, b.incoterm ?? null, b.cargo_description ?? null, b.weight_kg ?? null, b.volume_cbm ?? null,
          b.containers ?? null, tot.subtotal, tot.vat, tot.total, tot.cost_total, tot.margin_pct, b.valid_until?.slice(0, 10) ?? null, b.terms ?? null, b.notes ?? null],
      );
      await db.query('DELETE FROM quote_items WHERE quote_id=$1', [q.id]);
      for (const it of items) {
        await db.query(`INSERT INTO quote_items (tenant_id, quote_id, charge_type, description, quantity, unit_price, unit_cost, tax_code, supplier_id, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
          t, q.id, it.charge_type, it.description, it.quantity, it.unit_price, it.unit_cost, it.tax_code, it.supplier_id, it.sort,
        ]);
      }
      if (q.status !== 'draft') await db.query(`UPDATE approvals SET status='rejected', decision_note='Quote revised' WHERE entity_type='quote' AND entity_id=$1 AND status='pending'`, [q.id]);
      await auditFromReq(req, 'update', 'quote', q.id, { total: tot.total }, db);
    });
    res.json(await loadQuote(req, req.params.id));
  }),
);

/** Does this quote need owner approval before it can be sent? */
async function approvalReason(db: Db, tenantId: string, q: any): Promise<string | null> {
  const s = await getSettings(db, tenantId);
  if (Number(q.margin_pct) < s.min_margin_pct) return `Margin ${q.margin_pct}% is below the ${s.min_margin_pct}% floor`;
  if (Number(q.total) >= s.quote_approval_threshold) return `Value AED ${Number(q.total).toLocaleString()} exceeds the approval threshold`;
  return null;
}

quotesRouter.post(
  '/:id/submit',
  requirePerm('quotes', 'u'),
  wrap(async (req, res) => {
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const q = await one<any>(db, 'SELECT * FROM quotes WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, t]);
      if (!q) throw notFound();
      if (q.status !== 'draft') throw conflict(`Quote is ${q.status}`);
      const reason = await approvalReason(db, t, q);
      if (!reason) {
        await db.query(`UPDATE quotes SET status='approved' WHERE id=$1`, [q.id]);
        return { status: 'approved', approval: null };
      }
      const a = await requestApproval(db, {
        tenantId: t, entityType: 'quote', entityId: q.id, title: `Quote ${q.number}`, summary: reason, amount: q.total, priority: Number(q.margin_pct) < 0 ? 'high' : 'normal', requestedBy: req.user!.id,
      });
      await db.query(`UPDATE quotes SET status='pending_approval', approval_id=$2 WHERE id=$1`, [q.id, a.id]);
      return { status: 'pending_approval', approval: a };
    });
    res.json(out);
  }),
);

quotesRouter.post(
  '/:id/send',
  requirePerm('quotes', 'u'),
  wrap(async (req, res) => {
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const q = await one<any>(db, 'SELECT * FROM quotes WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, t]);
      if (!q) throw notFound();
      if (q.status === 'pending_approval') throw conflict('Waiting for approval');
      if (!['draft', 'approved', 'sent'].includes(q.status)) throw conflict(`Quote is ${q.status}`);
      if (q.status === 'draft') {
        const reason = await approvalReason(db, t, q);
        if (reason) throw conflict(`${reason}. Submit for approval first.`);
      }
      const row = (await db.query(`UPDATE quotes SET status='sent', sent_at=now() WHERE id=$1 RETURNING *`, [q.id])).rows[0];
      await db.query(`UPDATE deals SET stage='negotiation', probability=75 WHERE tenant_id=$1 AND quote_id=$2 AND stage='quoted'`, [t, q.id]);
      await auditFromReq(req, 'send', 'quote', q.id, {}, db);
      return row;
    });
    publish({ tenantId: req.user!.tenantId, type: 'quote.sent', entityType: 'quote', entityId: out.id, payload: { number: out.number, customer_id: out.customer_id }, userId: req.user!.id });
    res.json(out);
  }),
);

/** Accept a quote: creates the shipment (job) with milestones and charges. Staff or the customer via portal. */
quotesRouter.post(
  '/:id/accept',
  wrap(async (req, res) => {
    const isCustomer = req.user!.baseRole === 'customer';
    if (isCustomer ? !can(req, 'quotes', 'a') : !can(req, 'quotes', 'u')) throw forbidden();
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const q = await one<any>(db, 'SELECT * FROM quotes WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, t]);
      if (!q) throw notFound();
      if (isCustomer && q.customer_id !== req.user!.customerId) throw notFound();
      if (q.status === 'accepted' && q.shipment_id) return { quote: q, shipment_id: q.shipment_id, already: true };
      if (q.status !== 'sent') throw conflict(`Only sent quotes can be accepted (this one is ${q.status})`);
      if (q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10)) {
        await db.query(`UPDATE quotes SET status='expired' WHERE id=$1`, [q.id]);
        throw conflict('This quote has expired');
      }
      const s = await createShipment(db, t, req.user!.id, {
        customer_id: q.customer_id, quote_id: q.id, mode: q.mode, origin: q.origin, destination: q.destination, incoterm: q.incoterm, cargo_description: q.cargo_description,
        weight_kg: q.weight_kg, volume_cbm: q.volume_cbm, entity_id: q.entity_id,
      });
      await chargesFromQuote(db, t, s.id, q.id);
      const row = (await db.query(`UPDATE quotes SET status='accepted', accepted_at=now(), accepted_by=$2, shipment_id=$3 WHERE id=$1 RETURNING *`, [q.id, req.user!.name, s.id])).rows[0];
      await db.query(`UPDATE deals SET stage='won', probability=100 WHERE tenant_id=$1 AND quote_id=$2`, [t, q.id]);
      await auditFromReq(req, 'accept', 'quote', q.id, { shipment: s.number }, db);
      await notifyPermitted(t, 'shipments', 'c', { title: `Quote ${q.number} accepted → ${s.number}`, body: 'New job created. Confirm booking with the carrier.', level: 'success', link: `/shipments/${s.id}` }, db);
      publish({ tenantId: t, type: 'quote.accepted', entityType: 'quote', entityId: q.id, payload: { number: q.number, shipment_id: s.id, shipment_number: s.number }, userId: req.user!.id });
      return { quote: row, shipment_id: s.id, shipment_number: s.number };
    });
    res.json(out);
  }),
);

quotesRouter.post(
  '/:id/reject',
  wrap(async (req, res) => {
    const isCustomer = req.user!.baseRole === 'customer';
    if (isCustomer ? !can(req, 'quotes', 'a') : !can(req, 'quotes', 'u')) throw forbidden();
    const b = z.object({ reason: z.string().max(500).optional() }).parse(req.body || {});
    const q = await one<any>({ query }, 'SELECT * FROM quotes WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!q || (isCustomer && q.customer_id !== req.user!.customerId)) throw notFound();
    if (!(QUOTE_TRANSITIONS[q.status] || []).includes('rejected')) throw conflict(`Quote is ${q.status}`);
    await query(`UPDATE quotes SET status='rejected', notes=COALESCE(notes,'') || $2 WHERE id=$1`, [q.id, b.reason ? `\nRejected: ${b.reason}` : '']);
    await query(`UPDATE deals SET stage='lost', lost_reason=$3, probability=0 WHERE tenant_id=$1 AND quote_id=$2`, [req.user!.tenantId, q.id, b.reason ?? null]);
    await auditFromReq(req, 'reject', 'quote', q.id, b);
    res.json({ ok: true });
  }),
);

/** Duplicate as a new draft (revise/re-quote). */
quotesRouter.post(
  '/:id/duplicate',
  requirePerm('quotes', 'c'),
  wrap(async (req, res) => {
    const t = req.user!.tenantId;
    if (!isUuid(req.params.id)) throw notFound();
    const out = await tx(async (db) => {
      // Copy server-side from raw rows so buy costs are preserved even for users who cannot see them
      const src = await one<any>(db, 'SELECT * FROM quotes WHERE id=$1 AND tenant_id=$2', [req.params.id, t]);
      if (!src) throw notFound();
      const number = await nextRef(db, t, 'quote', 'Q-', 0, 2200);
      const q = (await db.query(
        `INSERT INTO quotes (tenant_id, entity_id, number, customer_id, mode, origin, destination, incoterm, cargo_description, weight_kg, volume_cbm, containers, subtotal, vat, total, cost_total, margin_pct, valid_until, terms, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,current_date + 14,$18,$19,$20) RETURNING *`,
        [t, src.entity_id, number, src.customer_id, src.mode, src.origin, src.destination, src.incoterm, src.cargo_description, src.weight_kg, src.volume_cbm, src.containers,
          src.subtotal, src.vat, src.total, src.cost_total, src.margin_pct, src.terms, src.notes, req.user!.id])).rows[0];
      await db.query(
        `INSERT INTO quote_items (tenant_id, quote_id, charge_type, description, quantity, unit_price, unit_cost, tax_code, supplier_id, sort)
         SELECT tenant_id, $2, charge_type, description, quantity, unit_price, unit_cost, tax_code, supplier_id, sort FROM quote_items WHERE quote_id=$1`,
        [src.id, q.id],
      );
      await auditFromReq(req, 'duplicate', 'quote', q.id, { from: src.number }, db);
      return q;
    });
    res.status(201).json(await loadQuote(req, out.id));
  }),
);
