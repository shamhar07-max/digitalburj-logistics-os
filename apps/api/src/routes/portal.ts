import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { many, one, query, tx } from '../db';
import { portalScope, requirePerm } from '../auth/middleware';
import { badRequest, notFound, wrap } from '../lib/errors';
import { notifyPermitted } from '../services/notify';
import { publish } from '../services/events';
import { auditFromReq } from '../services/audit';
import { sendPasswordLink } from './auth';
import { conflict } from '../lib/errors';
import bcrypt from 'bcryptjs';
import { randomToken } from '../lib/crypto';

/** Authenticated customer portal home. */
export const portalRouter = Router();

portalRouter.get(
  '/home',
  requirePerm('portal', 'r'),
  wrap(async (req, res) => {
    const c = portalScope(req);
    if (!c) throw badRequest('Portal home is for customer accounts');
    const t = req.user!.tenantId;
    const [customer, active, quotes, invoices, docs, unread, tenant] = await Promise.all([
      one({ query }, 'SELECT id, name, code FROM customers WHERE id=$1', [c]),
      many({ query }, `SELECT s.id, s.number, s.status, s.mode, s.origin, s.destination, s.eta, s.container_no,
          (SELECT count(*) FILTER (WHERE status='done')::text || '/' || count(*)::text FROM milestones m WHERE m.shipment_id=s.id) AS progress
          FROM shipments s WHERE s.tenant_id=$1 AND (s.customer_id=$2 OR s.consignee_id=$2) AND s.status NOT IN ('cancelled') AND (s.status NOT IN ('delivered','invoiced','closed') OR s.delivered_at > now() - interval '7 days') ORDER BY s.created_at DESC LIMIT 20`, [t, c]),
      many({ query }, `SELECT id, number, total, currency, valid_until, origin, destination, mode FROM quotes WHERE tenant_id=$1 AND customer_id=$2 AND status='sent' ORDER BY sent_at DESC`, [t, c]),
      many({ query }, `SELECT id, number, total, paid, due_date, status FROM invoices WHERE tenant_id=$1 AND customer_id=$2 AND kind='tax_invoice' AND status IN ('sent','partial','overdue') ORDER BY due_date`, [t, c]),
      many({ query }, `SELECT id, name, type, created_at FROM documents WHERE tenant_id=$1 AND is_public AND (customer_id=$2 OR shipment_id IN (SELECT id FROM shipments WHERE customer_id=$2 OR consignee_id=$2)) ORDER BY created_at DESC LIMIT 10`, [t, c]),
      one<any>({ query }, `SELECT COALESCE(SUM(unread),0)::int AS n FROM threads WHERE tenant_id=$1 AND customer_id=$2 AND channel='portal'`, [t, c]),
      one<any>({ query }, 'SELECT name FROM tenants WHERE id=$1', [t]),
    ]);
    res.json({ company: tenant!.name, customer, activeShipments: active, quotesAwaiting: quotes, unpaidInvoices: invoices, recentDocuments: docs, unreadMessages: unread!.n });
  }),
);

/** Invite a customer contact to the portal (staff action). */
portalRouter.post(
  '/invite',
  requirePerm('customers', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ customer_id: z.string().uuid(), name: z.string().min(2).max(120), email: z.string().email() }).parse(req.body);
    const t = req.user!.tenantId;
    if (!(await one({ query }, 'SELECT 1 FROM customers WHERE id=$1 AND tenant_id=$2', [b.customer_id, t]))) throw notFound('Customer not found');
    if (await one({ query }, 'SELECT 1 FROM users WHERE lower(email)=lower($1)', [b.email])) throw conflict('That email already has an account');
    const u = await one<any>({ query }, `INSERT INTO users (tenant_id, email, password_hash, name, role, customer_id) VALUES ($1,$2,$3,$4,'customer',$5) RETURNING id, tenant_id, email, name`, [t, b.email.toLowerCase(), await bcrypt.hash(randomToken(24), 12), b.name, b.customer_id]);
    const invite = await sendPasswordLink(u, 'invite');
    await auditFromReq(req, 'invite', 'user', u.id, { email: b.email, customer_id: b.customer_id });
    res.status(201).json({ user: { id: u.id, email: u.email, name: u.name }, invite });
  }),
);

// ─────────────────────── Public (no auth) ───────────────────────
export const publicRouter = Router();
const publicLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

/** Public shipment tracking by unguessable token. Reveals status + milestones only. */
publicRouter.get(
  '/track/:token',
  publicLimiter,
  wrap(async (req, res) => {
    if (!/^[a-f0-9A-Za-z_-]{16,64}$/.test(req.params.token)) throw notFound();
    const s = await one<any>({ query }, `SELECT s.id, s.number, s.status, s.mode, s.origin, s.destination, s.pol, s.pod, s.vessel, s.voyage, s.container_no, s.etd, s.eta, s.atd, s.ata, s.delivered_at, t.name AS company
        FROM shipments s JOIN tenants t ON t.id=s.tenant_id WHERE s.tracking_token=$1`, [req.params.token]);
    if (!s) throw notFound('Tracking link not found');
    const milestones = await many({ query }, 'SELECT name, status, due_at, done_at FROM milestones WHERE shipment_id=$1 ORDER BY sort', [s.id]);
    const { id, ...pub } = s;
    // never reveal billing state publicly: invoiced/closed jobs read as delivered
    if (['invoiced', 'closed'].includes(pub.status)) pub.status = 'delivered';
    res.json({ shipment: pub, milestones });
  }),
);

/** Website freight request -> CRM lead (deal) + notification. Honeypot + rate limit protect it from spam. */
publicRouter.post(
  '/request/:slug',
  rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  wrap(async (req, res) => {
    const b = z.object({
      name: z.string().min(2).max(120), company: z.string().max(150).optional(), email: z.string().email(), phone: z.string().max(40).optional(),
      origin: z.string().min(2).max(120), destination: z.string().min(2).max(120), mode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road', 'multimodal']).default('sea_fcl'),
      cargo: z.string().max(500).optional(), message: z.string().max(1500).optional(), website: z.string().max(0).optional(), // honeypot
    }).parse(req.body);
    const tenant = await one<any>({ query }, 'SELECT id FROM tenants WHERE slug=$1', [req.params.slug]);
    if (!tenant) throw notFound();
    const deal = await tx(async (db) => {
      let cust = await one<any>(db, 'SELECT id FROM customers WHERE tenant_id=$1 AND lower(email)=lower($2) LIMIT 1', [tenant.id, b.email]);
      if (!cust) {
        const n = await db.query(`INSERT INTO counters (tenant_id, key, value) VALUES ($1,'customers:code',1001) ON CONFLICT (tenant_id,key) DO UPDATE SET value=counters.value+1 RETURNING value`, [tenant.id]);
        cust = (await db.query(`INSERT INTO customers (tenant_id, code, name, email, phone, status, notes) VALUES ($1,$2,$3,$4,$5,'active','Created from website request') RETURNING id`, [tenant.id, 'CUS-' + n.rows[0].value, b.company || b.name, b.email, b.phone ?? null])).rows[0];
      }
      return (await db.query(`INSERT INTO deals (tenant_id, customer_id, title, stage, source, lane, mode, notes) VALUES ($1,$2,$3,'lead','website',$4,$5,$6) RETURNING id`, [
        tenant.id, cust.id, `${b.company || b.name}: ${b.origin} → ${b.destination}`, `${b.origin} → ${b.destination}`, b.mode, [b.cargo, b.message, `Contact: ${b.name} ${b.phone || ''}`].filter(Boolean).join('\n'),
      ])).rows[0];
    });
    await notifyPermitted(tenant.id, 'pipeline', 'u', { title: `New website request: ${b.origin} → ${b.destination}`, body: `${b.name} (${b.email})`, level: 'success', link: '/pipeline' });
    publish({ tenantId: tenant.id, type: 'lead.created', entityType: 'deal', entityId: deal.id, payload: { source: 'website' } });
    res.status(201).json({ ok: true, reference: deal.id.slice(0, 8).toUpperCase() });
  }),
);
