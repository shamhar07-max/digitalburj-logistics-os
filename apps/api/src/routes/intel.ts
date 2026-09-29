import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { round2 } from '@digitalburj/shared';
import { config } from '../config';
import { many, one, query } from '../db';
import { can, portalScope, requirePerm } from '../auth/middleware';
import { badRequest, notFound, wrap } from '../lib/errors';
import { AGENTS, runAgents, type Finding } from '../services/insights';
import { auditFromReq } from '../services/audit';
import { notifyPermitted } from '../services/notify';
import { arAgeing } from './invoices';
import { logger } from '../logger';

// ─────────────────────────── Dashboard ───────────────────────────
export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requirePerm('dashboard', 'r'),
  wrap(async (req, res) => {
    const t = req.user!.tenantId;
    const out: any = {};
    const jobs: Promise<any>[] = [];
    const add = (key: string, p: Promise<any>) => jobs.push(p.then((v) => (out[key] = v)));

    if (can(req, 'shipments', 'r')) {
      add('shipments', one({ query }, `SELECT count(*) FILTER (WHERE status NOT IN ('delivered','invoiced','closed','cancelled'))::int AS active,
            count(*) FILTER (WHERE created_at >= current_date)::int AS today, count(*) FILTER (WHERE risk_level='high' AND status NOT IN ('delivered','invoiced','closed','cancelled'))::int AS at_risk FROM shipments WHERE tenant_id=$1`, [t]));
      add('byStatus', many({ query }, `SELECT status, count(*)::int AS n FROM shipments WHERE tenant_id=$1 AND status NOT IN ('closed','cancelled') GROUP BY status`, [t]));
      add('byMode', many({ query }, `SELECT mode, count(*)::int AS n FROM shipments WHERE tenant_id=$1 AND status NOT IN ('closed','cancelled') GROUP BY mode`, [t]));
    }
    if (can(req, 'pipeline', 'r')) {
      add('pipeline', one({ query }, `SELECT COALESCE(SUM(value) FILTER (WHERE stage NOT IN ('won','lost')),0) AS value, count(*) FILTER (WHERE stage NOT IN ('won','lost'))::int AS deals FROM deals WHERE tenant_id=$1`, [t]));
    }
    if (can(req, 'invoices', 'r')) {
      add('ar', arAgeing(t, req.entityId).then((a) => ({ total: a.total, overdue: round2(a.total - a.totals.current), overdueCustomers: a.customers.filter((c) => c.total - c.buckets.current > 0).length, buckets: a.totals })));
      add('revenueTrend', many({ query }, `SELECT to_char(date_trunc('month', issue_date), 'YYYY-MM') AS month, COALESCE(SUM(CASE WHEN kind='credit_note' THEN -subtotal ELSE subtotal END),0) AS revenue
            FROM invoices WHERE tenant_id=$1 AND status NOT IN ('draft','void') AND issue_date >= date_trunc('month', current_date) - interval '5 months' GROUP BY 1 ORDER BY 1`, [t]));
      add('topCustomers', many({ query }, `SELECT c.id, c.name, COALESCE(SUM(i.subtotal),0) AS revenue FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.tenant_id=$1 AND i.kind='tax_invoice' AND i.status NOT IN ('draft','void') AND i.issue_date >= current_date - 90 GROUP BY c.id ORDER BY revenue DESC LIMIT 5`, [t]));
    }
    if (can(req, 'accounting', 'r')) {
      add('cash', one<any>({ query }, `SELECT COALESCE(SUM(l.debit - l.credit),0) AS bal FROM journal_lines l JOIN accounts a ON a.id=l.account_id AND (a.is_bank OR a.subtype='cash') JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' WHERE l.tenant_id=$1`, [t]).then((r) => round2(r?.bal || 0)));
    }
    if (can(req, 'costs', 'r')) {
      add('margin', one<any>({ query }, `SELECT COALESCE(SUM(CASE WHEN kind='revenue' THEN amount_aed END),0) AS rev, COALESCE(SUM(CASE WHEN kind='cost' THEN amount_aed END),0) AS cost
            FROM charges WHERE tenant_id=$1 AND created_at >= now() - interval '7 days'`, [t]).then((r) => ({ revenue: r!.rev, cost: r!.cost, pct: r!.rev ? round2(((r!.rev - r!.cost) / r!.rev) * 100) : 0 })));
    }
    if (can(req, 'approvals', 'r')) {
      add('approvals', one({ query }, `SELECT count(*)::int AS pending, count(*) FILTER (WHERE priority='high')::int AS high FROM approvals WHERE tenant_id=$1 AND status='pending'`, [t]));
    }
    if (can(req, 'ai', 'r')) {
      add('priority', runAgents(t).then((f) => f.filter((x) => x.severity !== 'low').slice(0, 6)));
    }
    add('activity', many({ query }, `SELECT user_name, action, entity_type, entity_id, changes, created_at FROM audit_log WHERE tenant_id=$1 AND action NOT IN ('login','login_failed','view') ORDER BY created_at DESC LIMIT 10`, [t]));
    await Promise.all(jobs);
    res.json(out);
  }),
);

// ─────────────────────────── AI agents + assistant ───────────────────────────
export const aiRouter = Router();
aiRouter.use(requirePerm('ai', 'r'));

aiRouter.get(
  '/agents',
  wrap(async (req, res) => {
    const findings = await runAgents(req.user!.tenantId);
    res.json({
      engine: config.ANTHROPIC_API_KEY ? 'rules + claude (assistant)' : 'rules (deterministic)',
      agents: AGENTS.map((a) => {
        const f = findings.filter((x) => x.agent === a.key);
        return { ...a, findings: f, high: f.filter((x) => x.severity === 'high').length, status: f.some((x) => x.severity === 'high') ? 'attention' : f.length ? 'watching' : 'clear' };
      }),
    });
  }),
);

aiRouter.post(
  '/actions/chase-pod',
  requirePerm('dispatch', 'r'),
  wrap(async (req, res) => {
    const b = z.object({ shipment_id: z.string().uuid() }).parse(req.body);
    const s = await one<any>({ query }, 'SELECT number FROM shipments WHERE id=$1 AND tenant_id=$2', [b.shipment_id, req.user!.tenantId]);
    if (!s) throw notFound();
    await notifyPermitted(req.user!.tenantId, 'dispatch', 'u', { title: `Chase POD for ${s.number}`, body: `${req.user!.name} asked to chase proof of delivery.`, level: 'warning', link: `/shipments/${b.shipment_id}` });
    await auditFromReq(req, 'chase_pod', 'shipment', b.shipment_id);
    res.json({ ok: true });
  }),
);

/** Assistant: grounded only in this user's permitted data. Read-only — it never writes, pays or files. */
aiRouter.post(
  '/chat',
  wrap(async (req, res) => {
    const b = z.object({ message: z.string().min(1).max(2000), history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(10).optional() }).parse(req.body);
    const t = req.user!.tenantId;
    const ctx: Record<string, any> = {};
    if (can(req, 'shipments', 'r')) {
      ctx.atRiskShipments = await many({ query }, `SELECT number, status, risk_reason, eta FROM shipments WHERE tenant_id=$1 AND risk_level<>'low' AND status NOT IN ('closed','cancelled','invoiced') ORDER BY risk_level DESC LIMIT 10`, [t]);
      ctx.activeShipments = (await one<any>({ query }, `SELECT count(*)::int AS n FROM shipments WHERE tenant_id=$1 AND status NOT IN ('delivered','invoiced','closed','cancelled')`, [t]))!.n;
    }
    if (can(req, 'invoices', 'r')) {
      const ar = await arAgeing(t, req.entityId);
      ctx.receivables = { total: ar.total, ageing: ar.totals, topDebtors: ar.customers.slice(0, 5).map((c) => ({ name: c.customer_name, total: c.total })) };
      ctx.unbilled = await many({ query }, `SELECT s.number, SUM(ch.amount_aed) AS amount FROM charges ch JOIN shipments s ON s.id=ch.shipment_id WHERE ch.tenant_id=$1 AND ch.kind='revenue' AND ch.invoice_id IS NULL AND s.status='delivered' GROUP BY s.number LIMIT 10`, [t]);
    }
    if (can(req, 'pipeline', 'r')) ctx.pipeline = await many({ query }, `SELECT stage, count(*)::int AS deals, COALESCE(SUM(value),0) AS value FROM deals WHERE tenant_id=$1 GROUP BY stage`, [t]);
    ctx.findings = (await runAgents(t)).filter((f) => f.severity !== 'low').slice(0, 8).map((f) => `${f.title} — ${f.detail}`);

    if (config.ANTHROPIC_API_KEY) {
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': config.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: config.ANTHROPIC_MODEL, max_tokens: 700,
            system: `You are the operations assistant inside DigitalBurj Logistics OS for a UAE freight forwarder. Answer concisely (max 6 short lines) using ONLY the JSON context provided. If the data is not in the context, say you don't have it. You are read-only: never claim to have performed actions, sent messages, paid or filed anything; suggest which screen to use instead. Amounts are AED. Context:\n${JSON.stringify(ctx).slice(0, 12000)}`,
            messages: [...(b.history || []), { role: 'user', content: b.message }],
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (r.ok) {
          const data: any = await r.json();
          return res.json({ reply: data.content?.find((c: any) => c.type === 'text')?.text || '', engine: 'claude' });
        }
        logger.warn({ status: r.status }, 'assistant call failed; falling back to rules');
      } catch (err) {
        logger.warn({ err }, 'assistant error; falling back to rules');
      }
    }
    res.json({ reply: ruleAnswer(b.message, ctx), engine: 'rules' });
  }),
);

function ruleAnswer(msg: string, ctx: Record<string, any>): string {
  const m = msg.toLowerCase();
  const aed = (n: number) => 'AED ' + Math.round(n).toLocaleString();
  if (/(risk|delay|late|problem|urgent|hold)/.test(m)) {
    const r = ctx.atRiskShipments as any[] | undefined;
    if (!r) return 'You do not have access to shipment data.';
    return r.length ? `${r.length} shipment(s) need attention:\n` + r.slice(0, 5).map((s) => `• ${s.number} (${s.status}) — ${s.risk_reason || 'flagged'}`).join('\n') : 'No shipments are currently flagged at risk.';
  }
  if (/(unbilled|not invoiced|bill)/.test(m)) {
    const u = ctx.unbilled as any[] | undefined;
    if (!u) return 'You do not have access to invoicing data.';
    return u.length ? `${u.length} delivered job(s) are unbilled:\n` + u.slice(0, 5).map((x) => `• ${x.number} — ${aed(x.amount)}`).join('\n') : 'All delivered jobs are invoiced.';
  }
  if (/(overdue|owe|receivable|ar\b|collect|debt)/.test(m)) {
    const r = ctx.receivables;
    if (!r) return 'You do not have access to receivables.';
    return `Outstanding receivables: ${aed(r.total)}. Overdue 1–30d ${aed(r.ageing.d1_30)}, 31–60d ${aed(r.ageing.d31_60)}, 60d+ ${aed(r.ageing.d61_90 + r.ageing.d90p)}.\nTop debtors: ` + (r.topDebtors as any[]).map((c) => `${c.name} (${aed(c.total)})`).join(', ');
  }
  if (/(pipeline|deal|lead|sales)/.test(m)) {
    const p = ctx.pipeline as any[] | undefined;
    if (!p) return 'You do not have access to the pipeline.';
    return p.map((s) => `${s.stage}: ${s.deals} deal(s), ${aed(s.value)}`).join('\n');
  }
  const f = ctx.findings as string[];
  return f?.length ? 'Here is what needs attention right now:\n' + f.slice(0, 5).map((x) => `• ${x}`).join('\n') : 'Nothing urgent right now. Ask me about risks, unbilled jobs, overdue invoices or the pipeline.';
}

// ─────────────────────────── Reports ───────────────────────────
export const reportsRouter = Router();
reportsRouter.use(requirePerm('reports', 'r'));

function csv(rows: any[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}
function respond(req: Request, res: Response, name: string, rows: any[], extra: object = {}) {
  if (req.query.format === 'csv') {
    if (!can(req, 'reports', 'x')) return res.status(403).json({ error: { message: 'Export not permitted' } });
    return res.type('text/csv').set('Content-Disposition', `attachment; filename="${name}.csv"`).send(csv(rows));
  }
  res.json({ data: rows, ...extra });
}
const range = (req: Request) => {
  const to = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}/.test(req.query.to) ? req.query.to.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const from = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}/.test(req.query.from) ? req.query.from.slice(0, 10) : new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
};

reportsRouter.get('/sales-performance', wrap(async (req, res) => {
  const { from, to } = range(req);
  const rows = await many({ query }, `SELECT COALESCE(u.name,'Unassigned') AS owner, count(*) FILTER (WHERE d.stage='won')::int AS won, count(*) FILTER (WHERE d.stage='lost')::int AS lost,
      count(*) FILTER (WHERE d.stage NOT IN ('won','lost'))::int AS open, COALESCE(SUM(d.value) FILTER (WHERE d.stage='won'),0) AS won_value, COALESCE(SUM(d.value) FILTER (WHERE d.stage NOT IN ('won','lost')),0) AS pipeline_value
    FROM deals d LEFT JOIN users u ON u.id=d.owner_id WHERE d.tenant_id=$1 AND d.created_at BETWEEN $2::date AND $3::date + 1 GROUP BY u.name ORDER BY won_value DESC`, [req.user!.tenantId, from, to]);
  respond(req, res, 'sales-performance', rows, { from, to });
}));

reportsRouter.get('/lane-profitability', requirePerm('costs', 'r'), wrap(async (req, res) => {
  const { from, to } = range(req);
  const rows = await many<any>({ query }, `SELECT COALESCE(s.origin,'?') || ' → ' || COALESCE(s.destination,'?') AS lane, s.mode, count(DISTINCT s.id)::int AS shipments,
      COALESCE(SUM(ch.amount_aed) FILTER (WHERE ch.kind='revenue'),0) AS revenue, COALESCE(SUM(ch.amount_aed) FILTER (WHERE ch.kind='cost'),0) AS cost
    FROM shipments s LEFT JOIN charges ch ON ch.shipment_id=s.id WHERE s.tenant_id=$1 AND s.created_at BETWEEN $2::date AND $3::date + 1 AND s.status <> 'cancelled' GROUP BY 1, s.mode ORDER BY revenue DESC`, [req.user!.tenantId, from, to]);
  respond(req, res, 'lane-profitability', rows.map((r) => ({ ...r, margin: round2(r.revenue - r.cost), margin_pct: r.revenue ? round2(((r.revenue - r.cost) / r.revenue) * 100) : 0 })), { from, to });
}));

reportsRouter.get('/job-costing', requirePerm('costs', 'r'), wrap(async (req, res) => {
  const { from, to } = range(req);
  const rows = await many<any>({ query }, `SELECT s.id, s.number, (SELECT name FROM customers c WHERE c.id=s.customer_id) AS customer, s.mode, s.status,
      COALESCE(SUM(ch.amount_aed) FILTER (WHERE ch.kind='revenue'),0) AS revenue, COALESCE(SUM(ch.amount_aed) FILTER (WHERE ch.kind='cost'),0) AS cost
    FROM shipments s LEFT JOIN charges ch ON ch.shipment_id=s.id WHERE s.tenant_id=$1 AND s.created_at BETWEEN $2::date AND $3::date + 1 AND s.status <> 'cancelled' GROUP BY s.id ORDER BY s.created_at DESC`, [req.user!.tenantId, from, to]);
  respond(req, res, 'job-costing', rows.map((r) => ({ ...r, margin: round2(r.revenue - r.cost), margin_pct: r.revenue ? round2(((r.revenue - r.cost) / r.revenue) * 100) : 0 })), { from, to });
}));

reportsRouter.get('/ar-ageing', requirePerm('invoices', 'r'), wrap(async (req, res) => {
  const a = await arAgeing(req.user!.tenantId, req.entityId);
  if (req.query.format === 'csv') return respond(req, res, 'ar-ageing', a.customers.map((c) => ({ customer: c.customer_name, total: c.total, ...c.buckets })));
  res.json(a);
}));

reportsRouter.get('/customs-clearance', wrap(async (req, res) => {
  const { from, to } = range(req);
  const rows = await many({ query }, `SELECT type, count(*)::int AS declarations, count(*) FILTER (WHERE status='cleared')::int AS cleared, count(*) FILTER (WHERE status='hold')::int AS on_hold,
      count(*) FILTER (WHERE status='rejected')::int AS rejected, round(AVG(EXTRACT(epoch FROM (cleared_at - submitted_at))/86400) FILTER (WHERE cleared_at IS NOT NULL AND submitted_at IS NOT NULL)::numeric, 1) AS avg_days_to_clear,
      COALESCE(SUM(duty_amount),0) AS duty
    FROM customs_declarations WHERE tenant_id=$1 AND created_at BETWEEN $2::date AND $3::date + 1 GROUP BY type`, [req.user!.tenantId, from, to]);
  respond(req, res, 'customs-clearance', rows, { from, to });
}));

reportsRouter.get('/driver-productivity', wrap(async (req, res) => {
  const { from, to } = range(req);
  const rows = await many({ query }, `SELECT d.name AS driver, count(DISTINCT tr.id)::int AS trips, count(ts.id) FILTER (WHERE ts.status='done')::int AS stops_done, count(ts.id) FILTER (WHERE ts.status='failed')::int AS stops_failed,
      count(p.id)::int AS pods, count(p.id) FILTER (WHERE p.status='verified')::int AS pods_verified
    FROM drivers d LEFT JOIN trips tr ON tr.driver_id=d.id AND tr.planned_date BETWEEN $2::date AND $3::date LEFT JOIN trip_stops ts ON ts.trip_id=tr.id LEFT JOIN pods p ON p.trip_stop_id=ts.id
    WHERE d.tenant_id=$1 GROUP BY d.id ORDER BY stops_done DESC`, [req.user!.tenantId, from, to]);
  respond(req, res, 'driver-productivity', rows, { from, to });
}));

reportsRouter.get('/carrier-scorecard', wrap(async (req, res) => {
  const { from, to } = range(req);
  const rows = await many({ query }, `SELECT COALESCE(carrier,'Unknown') AS carrier, count(*)::int AS shipments,
      count(*) FILTER (WHERE ata IS NOT NULL AND eta IS NOT NULL AND ata <= eta)::int AS on_time, count(*) FILTER (WHERE ata IS NOT NULL AND eta IS NOT NULL)::int AS measured,
      round(AVG(ata - eta) FILTER (WHERE ata IS NOT NULL AND eta IS NOT NULL)::numeric, 1) AS avg_delay_days
    FROM shipments WHERE tenant_id=$1 AND created_at BETWEEN $2::date AND $3::date + 1 GROUP BY 1 ORDER BY shipments DESC`, [req.user!.tenantId, from, to]);
  respond(req, res, 'carrier-scorecard', (rows as any[]).map((r) => ({ ...r, on_time_pct: r.measured ? Math.round((r.on_time / r.measured) * 100) : null })), { from, to });
}));

reportsRouter.get('/growth-attribution', wrap(async (req, res) => {
  const rows = await many({ query }, `SELECT COALESCE(source,'unknown') AS source, count(*)::int AS deals, count(*) FILTER (WHERE stage='won')::int AS won, COALESCE(SUM(value) FILTER (WHERE stage='won'),0) AS won_value FROM deals WHERE tenant_id=$1 GROUP BY 1 ORDER BY won_value DESC`, [req.user!.tenantId]);
  respond(req, res, 'growth-attribution', rows);
}));

// ─────────────────────────── Global search & notifications ───────────────────────────
export const searchRouter = Router();
searchRouter.get(
  '/',
  wrap(async (req, res) => {
    const term = String(req.query.q || '').trim();
    if (term.length < 2) return res.json({ results: [] });
    if (portalScope(req)) throw badRequest('Search is not available in the portal');
    const like = '%' + term.replace(/[\\%_]/g, '\\$&') + '%';
    const t = req.user!.tenantId;
    const results: any[] = [];
    const jobs: Promise<any>[] = [];
    if (can(req, 'shipments', 'r')) jobs.push(many<any>({ query }, `SELECT id, number, container_no, status FROM shipments WHERE tenant_id=$1 AND (number ILIKE $2 OR container_no ILIKE $2 OR bl_number ILIKE $2 OR awb_number ILIKE $2 OR cargo_description ILIKE $2) ORDER BY created_at DESC LIMIT 6`, [t, like]).then((r) => r.forEach((x) => results.push({ type: 'Shipment', id: x.id, title: x.number, sub: [x.container_no, x.status].filter(Boolean).join(' · '), path: `/shipments/${x.id}` }))));
    if (can(req, 'customers', 'r')) jobs.push(many<any>({ query }, `SELECT id, code, name FROM customers WHERE tenant_id=$1 AND (name ILIKE $2 OR code ILIKE $2 OR trn ILIKE $2) LIMIT 5`, [t, like]).then((r) => r.forEach((x) => results.push({ type: 'Customer', id: x.id, title: x.name, sub: x.code, path: `/customers` }))));
    if (can(req, 'quotes', 'r')) jobs.push(many<any>({ query }, `SELECT id, number, status, total FROM quotes WHERE tenant_id=$1 AND number ILIKE $2 LIMIT 4`, [t, like]).then((r) => r.forEach((x) => results.push({ type: 'Quote', id: x.id, title: x.number, sub: x.status, path: `/quotes/${x.id}` }))));
    if (can(req, 'invoices', 'r')) jobs.push(many<any>({ query }, `SELECT id, number, status, total FROM invoices WHERE tenant_id=$1 AND number ILIKE $2 LIMIT 4`, [t, like]).then((r) => r.forEach((x) => results.push({ type: 'Invoice', id: x.id, title: x.number, sub: `${x.status} · AED ${Number(x.total).toLocaleString()}`, path: `/invoices` }))));
    if (can(req, 'pipeline', 'r')) jobs.push(many<any>({ query }, `SELECT id, title, stage FROM deals WHERE tenant_id=$1 AND title ILIKE $2 LIMIT 4`, [t, like]).then((r) => r.forEach((x) => results.push({ type: 'Deal', id: x.id, title: x.title, sub: x.stage, path: `/pipeline` }))));
    await Promise.all(jobs);
    res.json({ results });
  }),
);

export const notificationsRouter = Router();
notificationsRouter.get(
  '/',
  wrap(async (req, res) => {
    const rows = await many({ query }, `SELECT * FROM notifications WHERE tenant_id=$1 AND (user_id=$2 OR user_id IS NULL) ORDER BY created_at DESC LIMIT 50`, [req.user!.tenantId, req.user!.id]);
    const unread = await one<any>({ query }, `SELECT count(*)::int AS n FROM notifications WHERE tenant_id=$1 AND (user_id=$2 OR user_id IS NULL) AND read_at IS NULL`, [req.user!.tenantId, req.user!.id]);
    res.json({ data: rows, unread: unread!.n });
  }),
);
notificationsRouter.post(
  '/read',
  wrap(async (req, res) => {
    const b = z.object({ ids: z.array(z.string().uuid()).optional() }).parse(req.body || {});
    await query(`UPDATE notifications SET read_at=now() WHERE tenant_id=$1 AND (user_id=$2 OR user_id IS NULL) AND read_at IS NULL ${b.ids?.length ? 'AND id = ANY($3)' : ''}`, b.ids?.length ? [req.user!.tenantId, req.user!.id, b.ids] : [req.user!.tenantId, req.user!.id]);
    res.json({ ok: true });
  }),
);

export type { Finding };
