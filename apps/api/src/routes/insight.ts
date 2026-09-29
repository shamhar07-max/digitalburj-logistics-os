import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { fileCompleteness, round2, type HubInput, type VelocityRecord } from '@digitalburj/shared';
import { many, one, query } from '../db';
import { can, requirePerm } from '../auth/middleware';
import { badRequest, forbidden, notFound, wrap } from '../lib/errors';
import { isUuid } from '../crud/validate';

/** Portal roles (customer, partner, driver) never see operational analytics. */
const staffOnly = (req: Request, _res: Response, next: NextFunction) => (['customer', 'partner', 'driver'].includes(req.user!.baseRole) ? next(forbidden()) : next());

const iso = (v: unknown) => (v ? new Date(v as any).toISOString() : null);

export const insightRouter = Router();
insightRouter.use(staffOnly);

// ───────────── Operational velocity: Quote Accepted → Documents Generated ─────────────
/**
 * One record per accepted quote whose job has a confirmed booking and a complete generated document set. Analytics run
 * on the shared `measure()` so server and UI agree. `coverage` says how many accepted quotes in the window are not yet
 * measurable (still awaiting booking confirmation or documents) so the report never silently hides them.
 */
insightRouter.get(
  '/velocity',
  requirePerm('reports', 'r'),
  wrap(async (req, res) => {
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days), 10) || 90));
    const t = req.user!.tenantId;
    const ent = req.entityId ?? null;
    const params = [t, days, ent];
    const rows = await many<any>(
      { query },
      `SELECT s.id, s.number AS job_no, q.number AS quote_no, c.name AS customer, s.mode, concat_ws(' → ', s.origin, s.destination) AS lane,
              q.accepted_at, s.created_at AS job_created_at, bm.done_at AS carrier_confirmed_at, d.docs_at, cm.done_at AS customs_at,
              (c.trn IS NULL OR c.trn = '') AS missing_trn
         FROM shipments s
         JOIN quotes q ON q.id = s.quote_id AND q.accepted_at IS NOT NULL
         JOIN customers c ON c.id = s.customer_id
         JOIN milestones bm ON bm.shipment_id = s.id AND bm.code = 'booking' AND bm.done_at IS NOT NULL
         JOIN LATERAL (SELECT max(first_at) AS docs_at, count(*)::int AS n
                         FROM (SELECT type, min(generated_at) AS first_at FROM documents WHERE shipment_id = s.id AND origin = 'generated' GROUP BY type) x) d ON d.n >= 3
         LEFT JOIN milestones cm ON cm.shipment_id = s.id AND cm.code = 'customs' AND cm.done_at IS NOT NULL
        WHERE s.tenant_id = $1 AND q.accepted_at >= now() - ($2::int * interval '1 day') AND ($3::uuid IS NULL OR s.entity_id = $3)
        ORDER BY q.accepted_at DESC LIMIT 500`,
      params,
    );
    const total = await one<{ n: number }>(
      { query },
      `SELECT count(*)::int AS n FROM shipments s JOIN quotes q ON q.id = s.quote_id AND q.accepted_at IS NOT NULL
        WHERE s.tenant_id = $1 AND q.accepted_at >= now() - ($2::int * interval '1 day') AND ($3::uuid IS NULL OR s.entity_id = $3)`,
      params,
    );
    const records: VelocityRecord[] = rows.map((r) => ({
      id: r.id, shipmentId: r.id, jobNo: r.job_no, quoteNo: r.quote_no, customer: r.customer, mode: r.mode, lane: r.lane,
      acceptedAt: iso(r.accepted_at)!, jobCreatedAt: iso(r.job_created_at)!, carrierConfirmedAt: iso(r.carrier_confirmed_at)!, docsGeneratedAt: iso(r.docs_at)!,
      customsClearedAt: iso(r.customs_at), holdReason: r.missing_trn ? 'missing_trn' : null,
    }));
    res.json({ records, days, coverage: { acceptedQuotes: total?.n ?? 0, measured: records.length, pending: Math.max(0, (total?.n ?? 0) - records.length) } });
  }),
);

// ───────────── Modal Hub inputs ─────────────
/** Raw rows for the Sea / Air / Road lanes; the lane maths lives in the shared `buildHub`. No cost fields are returned. */
insightRouter.get(
  '/modal-hub',
  requirePerm('shipments', 'r'),
  wrap(async (req, res) => {
    const t = req.user!.tenantId;
    const ent = req.entityId ?? null;
    const dispatch = can(req, 'dispatch', 'r');
    const [shipments, vehicles, equipment, trips, allocations, pools] = await Promise.all([
      many<any>({ query }, `SELECT s.id, s.number, c.name AS customer, s.mode, s.status, s.risk_level, s.risk_reason, s.origin, s.destination, s.vessel, s.voyage, s.container_type, s.containers, s.weight_kg, s.volume_cbm, s.free_days_end
                              FROM shipments s LEFT JOIN customers c ON c.id = s.customer_id
                             WHERE s.tenant_id = $1 AND s.status NOT IN ('delivered','invoiced','closed','cancelled') AND ($2::uuid IS NULL OR s.entity_id = $2)
                             ORDER BY s.created_at DESC LIMIT 500`, [t, ent]),
      dispatch ? many<any>({ query }, `SELECT v.id, v.plate, v.type, v.status, d.name AS driver_name, v.fuel_pct, v.salik_balance, v.odometer_km, v.next_service_km, v.mulkiya_expiry, v.insurance_expiry
                                        FROM vehicles v LEFT JOIN drivers d ON d.vehicle_id = v.id WHERE v.tenant_id = $1 ORDER BY v.plate`, [t]) : Promise.resolve([]),
      dispatch ? many<any>({ query }, `SELECT code, category, status FROM equipment WHERE tenant_id = $1`, [t]) : Promise.resolve([]),
      dispatch ? many<any>({ query }, `SELECT status FROM trips WHERE tenant_id = $1 AND (status IN ('unassigned','assigned','in_progress') OR (status = 'completed' AND completed_at >= current_date))`, [t]) : Promise.resolve([]),
      many<any>({ query }, `SELECT id, mode, carrier, vessel, voyage, route, cutoff_at, allocated, other_booked, unit FROM capacity_allocations WHERE tenant_id = $1 AND cutoff_at > now() - interval '1 day' ORDER BY cutoff_at`, [t]),
      many<any>({ query }, `SELECT id, mode, kind, code, label, total, in_use, damaged, unit, sort FROM equipment_pools WHERE tenant_id = $1 ORDER BY mode, sort, code`, [t]),
    ]);
    const input: HubInput = {
      shipments: shipments.map((s) => ({ ...s, free_days_end: iso(s.free_days_end) })),
      vehicles: vehicles.map((v) => ({ ...v, mulkiya_expiry: v.mulkiya_expiry ? String(v.mulkiya_expiry).slice(0, 10) : null, insurance_expiry: v.insurance_expiry ? String(v.insurance_expiry).slice(0, 10) : null })),
      equipment, trips,
      allocations: allocations.map((a) => ({ ...a, cutoff_at: iso(a.cutoff_at)! })),
      pools,
    };
    res.json({ now: Date.now(), input });
  }),
);

// ───────────── "Explain this number" ─────────────
interface ExplainRow { id: string; ref: string; title: string; detail?: string; amount?: number; link?: string }
interface Explained { metric: string; label: string; value: number; unit: 'count' | 'AED' | '%'; formula: string; records: ExplainRow[] }

insightRouter.get(
  '/explain/:metric',
  requirePerm('dashboard', 'r'),
  wrap(async (req, res) => {
    const t = req.user!.tenantId;
    const ent = req.entityId ?? null;
    const need = (module: string) => { if (!can(req, module, 'r')) throw forbidden(); };
    const activeWhere = `s.tenant_id = $1 AND s.status NOT IN ('delivered','invoiced','closed','cancelled') AND ($2::uuid IS NULL OR s.entity_id = $2)`;
    const shipRow = (s: any): ExplainRow => ({ id: s.id, ref: s.number, title: s.customer ?? '—', detail: `${s.mode.replace('_', ' ')} · ${s.status.replace('_', ' ')}${s.origin ? ` · ${s.origin} → ${s.destination ?? '?'}` : ''}`, link: `/shipments/${s.id}` });
    let out: Explained;

    switch (req.params.metric) {
      case 'active_shipments': {
        need('shipments');
        const rows = await many<any>({ query }, `SELECT s.id, s.number, s.mode, s.status, s.origin, s.destination, c.name AS customer FROM shipments s LEFT JOIN customers c ON c.id = s.customer_id WHERE ${activeWhere} ORDER BY s.created_at DESC LIMIT 200`, [t, ent]);
        out = { metric: 'active_shipments', label: 'Active shipments', value: rows.length, unit: 'count', formula: 'Shipments not yet delivered, invoiced, closed or cancelled.', records: rows.map(shipRow) };
        break;
      }
      case 'at_risk': {
        need('shipments');
        const rows = await many<any>({ query }, `SELECT s.id, s.number, s.mode, s.status, s.origin, s.destination, s.risk_reason, c.name AS customer FROM shipments s LEFT JOIN customers c ON c.id = s.customer_id WHERE ${activeWhere} AND s.risk_level = 'high' ORDER BY s.created_at DESC LIMIT 200`, [t, ent]);
        out = { metric: 'at_risk', label: 'High-risk shipments', value: rows.length, unit: 'count', formula: 'Active shipments the risk engine rates "high" (expiring free time, customs hold, ETA slippage).', records: rows.map((r) => ({ ...shipRow(r), detail: r.risk_reason ?? shipRow(r).detail })) };
        break;
      }
      case 'ready_to_invoice': {
        need('invoices');
        const rows = await many<any>({ query }, `SELECT s.id, s.number, c.name AS customer, s.mode, s.status, s.origin, s.destination, SUM(ch.amount_aed) AS amount
                                                   FROM shipments s JOIN charges ch ON ch.shipment_id = s.id AND ch.kind = 'revenue' AND ch.invoice_id IS NULL LEFT JOIN customers c ON c.id = s.customer_id
                                                  WHERE s.tenant_id = $1 AND s.status = 'delivered' AND ($2::uuid IS NULL OR s.entity_id = $2) GROUP BY s.id, c.name HAVING SUM(ch.amount_aed) > 0 ORDER BY amount DESC LIMIT 200`, [t, ent]);
        out = { metric: 'ready_to_invoice', label: 'Ready to invoice', value: round2(rows.reduce((n, r) => n + Number(r.amount), 0)), unit: 'AED', formula: 'Revenue charges (AED) on delivered shipments that are not yet on an invoice.', records: rows.map((r) => ({ ...shipRow(r), amount: Number(r.amount) })) };
        break;
      }
      case 'pending_approvals': {
        need('approvals');
        const rows = await many<any>({ query }, `SELECT id, title, summary, amount, priority FROM approvals WHERE tenant_id = $1 AND status = 'pending' ORDER BY (priority = 'high') DESC, created_at LIMIT 200`, [t]);
        out = { metric: 'pending_approvals', label: 'Pending approvals', value: rows.length, unit: 'count', formula: 'Requests waiting for a decision.', records: rows.map((r) => ({ id: r.id, ref: r.priority === 'high' ? 'HIGH' : 'Normal', title: r.title, detail: r.summary ?? undefined, amount: r.amount != null ? Number(r.amount) : undefined, link: '/approvals' })) };
        break;
      }
      case 'overdue_ar': {
        need('invoices');
        const rows = await many<any>({ query }, `SELECT i.id, i.number, c.name AS customer, i.due_date, (i.total - i.paid) AS outstanding FROM invoices i JOIN customers c ON c.id = i.customer_id
                                                  WHERE i.tenant_id = $1 AND i.kind = 'tax_invoice' AND i.status IN ('sent','partial','overdue') AND i.due_date < current_date ORDER BY i.due_date LIMIT 200`, [t]);
        out = { metric: 'overdue_ar', label: 'Overdue receivables', value: round2(rows.reduce((n, r) => n + Number(r.outstanding), 0)), unit: 'AED', formula: 'Outstanding balance (total − paid) on sent or part-paid tax invoices past their due date.', records: rows.map((r) => ({ id: r.id, ref: r.number, title: r.customer, detail: `Due ${String(r.due_date).slice(0, 10)}`, amount: Number(r.outstanding), link: '/invoices' })) };
        break;
      }
      case 'margin_7d': {
        need('costs');
        const rows = await many<any>({ query }, `SELECT s.id, s.number, c.name AS customer, s.mode, s.status, s.origin, s.destination,
                                                    COALESCE(SUM(ch.amount_aed) FILTER (WHERE ch.kind='revenue'),0) AS rev, COALESCE(SUM(ch.amount_aed) FILTER (WHERE ch.kind='cost'),0) AS cost
                                                   FROM charges ch JOIN shipments s ON s.id = ch.shipment_id LEFT JOIN customers c ON c.id = s.customer_id
                                                  WHERE ch.tenant_id = $1 AND ch.created_at >= now() - interval '7 days' GROUP BY s.id, c.name ORDER BY rev DESC LIMIT 200`, [t]);
        const rev = rows.reduce((n, r) => n + Number(r.rev), 0);
        const cost = rows.reduce((n, r) => n + Number(r.cost), 0);
        out = { metric: 'margin_7d', label: 'Gross margin (7 days)', value: rev ? round2(((rev - cost) / rev) * 100) : 0, unit: '%', formula: `(Revenue − cost) ÷ revenue on charges created in the last 7 days. Revenue AED ${round2(rev).toLocaleString('en-AE')}, cost AED ${round2(cost).toLocaleString('en-AE')}.`,
          records: rows.map((r) => ({ ...shipRow(r), amount: round2(Number(r.rev) - Number(r.cost)), detail: `Revenue ${round2(Number(r.rev)).toLocaleString('en-AE')} · cost ${round2(Number(r.cost)).toLocaleString('en-AE')}` })) };
        break;
      }
      default:
        throw notFound('Unknown metric');
    }
    res.json(out);
  }),
);

// ───────────── Mandatory-document scorecard ─────────────
const UAE_ORIGIN = /(dubai|jebel ali|abu dhabi|sharjah|ajman|fujairah|ras al khaimah|uae|emirates|\bdxb\b|\bauh\b|\bdwc\b|\bshj\b|\bjea\b)/i;

insightRouter.get(
  '/document-scorecard',
  requirePerm('documents', 'r'),
  wrap(async (req, res) => {
    const rows = await many<any>({ query },
      `SELECT s.id, s.number, s.mode, s.status, s.origin, s.destination, c.name AS customer,
              COALESCE((SELECT array_agg(DISTINCT d.type) FROM documents d WHERE d.shipment_id = s.id AND d.tenant_id = s.tenant_id), '{}') AS types,
              EXISTS (SELECT 1 FROM customs_declarations cd WHERE cd.shipment_id = s.id) AS has_declaration
         FROM shipments s LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.tenant_id = $1 AND s.status NOT IN ('closed','cancelled','invoiced') AND ($2::uuid IS NULL OR s.entity_id = $2) ORDER BY s.created_at DESC LIMIT 200`, [req.user!.tenantId, req.entityId ?? null]);
    const shipments = rows.map((r) => {
      // Direction is not stored on the job; an origin inside the UAE is treated as an export. Stated in the UI.
      const direction: 'import' | 'export' = UAE_ORIGIN.test(r.origin ?? '') ? 'export' : 'import';
      const have = [...(r.types as string[]), ...(r.has_declaration ? ['CUSTOMS_DECLARATION'] : [])];
      const f = fileCompleteness(r.mode, have, direction);
      return { id: r.id, number: r.number, customer: r.customer, mode: r.mode, status: r.status, direction, pct: f.pct, present: f.checks.filter((c) => c.present).map((c) => c.label), missing: f.missing };
    });
    const score = shipments.length ? Math.round(shipments.reduce((n, s) => n + s.pct, 0) / shipments.length) : 100;
    res.json({ score, complete: shipments.filter((s) => s.pct === 100).length, total: shipments.length, shipments });
  }),
);

// ───────────── Branch notes ─────────────
export const notesRouter = Router();
notesRouter.use(staffOnly);

const noteSchema = z.object({ body: z.string().trim().min(1).max(500), priority: z.enum(['normal', 'urgent', 'info']).default('normal') });

notesRouter.get('/', requirePerm('dashboard', 'r'), wrap(async (req, res) => {
  const ent = req.entityId ?? req.user!.entityIds[0] ?? null;
  const rows = await many({ query }, `SELECT id, entity_id, author_id, author_name, body, priority, created_at FROM notes WHERE tenant_id = $1 AND ($2::uuid IS NULL OR entity_id = $2 OR entity_id IS NULL) ORDER BY created_at DESC LIMIT 30`, [req.user!.tenantId, ent]);
  res.json({ data: rows });
}));

notesRouter.post('/', requirePerm('dashboard', 'r'), wrap(async (req, res) => {
  const b = noteSchema.parse(req.body);
  const ent = req.entityId ?? req.user!.entityIds[0] ?? null;
  const row = await one({ query }, `INSERT INTO notes (tenant_id, entity_id, author_id, author_name, body, priority) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, entity_id, author_id, author_name, body, priority, created_at`,
    [req.user!.tenantId, ent, req.user!.id, req.user!.name, b.body, b.priority]);
  res.status(201).json(row);
}));

notesRouter.delete('/:id', requirePerm('dashboard', 'r'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound();
  const n = await one<any>({ query }, 'SELECT author_id FROM notes WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
  if (!n) throw notFound();
  if (n.author_id !== req.user!.id && !['owner', 'admin'].includes(req.user!.baseRole)) throw badRequest('Only the author or an admin can remove a note');
  await query('DELETE FROM notes WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));
