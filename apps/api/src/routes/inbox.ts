import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { waId } from '@digitalburj/shared';
import { config } from '../config';
import { many, one, query, tx } from '../db';
import { portalScope, requirePerm } from '../auth/middleware';
import { forbidden, notFound, wrap } from '../lib/errors';
import { isUuid } from '../crud/validate';
import { hmacSha256, timingSafeEq } from '../lib/crypto';
import { auditFromReq } from '../services/audit';
import { publish } from '../services/events';
import { sendOnChannel } from '../services/channels';
import { notifyPermitted } from '../services/notify';
import { logger } from '../logger';

export const inboxRouter = Router();

inboxRouter.get(
  '/threads',
  requirePerm('inbox', 'r'),
  wrap(async (req, res) => {
    const { channel, unread, search, status } = req.query as Record<string, string>;
    const params: any[] = [req.user!.tenantId];
    const where = ['t.tenant_id=$1'];
    const push = (v: any) => (params.push(v), '$' + params.length);
    const cust = portalScope(req);
    if (cust) where.push(`t.customer_id=${push(cust)}`, `t.channel='portal'`);
    if (channel) where.push(`t.channel=${push(channel)}`);
    if (unread === 'true') where.push('t.unread > 0');
    if (status) where.push(`t.status=${push(status)}`);
    if (search) {
      const p = push('%' + search.replace(/[\\%_]/g, '\\$&') + '%');
      where.push(`(t.contact_name ILIKE ${p} OR t.subject ILIKE ${p} OR t.last_message_preview ILIKE ${p} OR c.name ILIKE ${p})`);
    }
    const rows = await many({ query }, `SELECT t.*, c.name AS customer_name, (SELECT number FROM shipments s WHERE s.id=t.shipment_id) AS shipment_number
        FROM threads t LEFT JOIN customers c ON c.id=t.customer_id WHERE ${where.join(' AND ')} ORDER BY t.last_message_at DESC LIMIT 200`, params);
    const counts = await one({ query }, `SELECT count(*)::int AS total, count(*) FILTER (WHERE unread > 0)::int AS unread FROM threads WHERE tenant_id=$1 AND status='open'`, [req.user!.tenantId]);
    res.json({ data: rows, counts });
  }),
);

async function loadThread(req: Request, id: string) {
  if (!isUuid(id)) throw notFound();
  const cust = portalScope(req);
  const t = await one<any>({ query }, `SELECT t.*, c.name AS customer_name FROM threads t LEFT JOIN customers c ON c.id=t.customer_id WHERE t.id=$1 AND t.tenant_id=$2 ${cust ? 'AND t.customer_id=$3' : ''}`, cust ? [id, req.user!.tenantId, cust] : [id, req.user!.tenantId]);
  if (!t) throw notFound();
  return t;
}

inboxRouter.get(
  '/threads/:id',
  requirePerm('inbox', 'r'),
  wrap(async (req, res) => {
    const t = await loadThread(req, req.params.id);
    const isCustomer = req.user!.baseRole === 'customer';
    const messages = await many({ query }, `SELECT * FROM messages WHERE thread_id=$1 ${isCustomer ? "AND direction <> 'note'" : ''} ORDER BY created_at`, [t.id]);
    let context: any = null;
    if (!isCustomer && t.customer_id) {
      const [cust, ships, ar] = await Promise.all([
        one({ query }, 'SELECT id, code, name, status, credit_limit, phone, email FROM customers WHERE id=$1', [t.customer_id]),
        many({ query }, `SELECT id, number, status, origin, destination, eta, risk_level FROM shipments WHERE customer_id=$1 AND status NOT IN ('closed','cancelled') ORDER BY created_at DESC LIMIT 5`, [t.customer_id]),
        one<any>({ query }, `SELECT COALESCE(SUM(total-paid),0) AS outstanding FROM invoices WHERE customer_id=$1 AND status IN ('sent','partial','overdue')`, [t.customer_id]),
      ]);
      context = { customer: cust, shipments: ships, outstanding: ar?.outstanding || 0 };
    }
    if (t.unread > 0 && !isCustomer) await query('UPDATE threads SET unread=0 WHERE id=$1', [t.id]);
    res.json({ thread: { ...t, unread: 0 }, messages, context });
  }),
);

inboxRouter.post(
  '/threads',
  requirePerm('inbox', 'c'),
  wrap(async (req, res) => {
    const b = z.object({
      customer_id: z.string().uuid().nullish(), shipment_id: z.string().uuid().nullish(), channel: z.enum(['whatsapp', 'email', 'portal', 'phone']),
      external_id: z.string().max(200).nullish(), contact_name: z.string().max(120).nullish(), subject: z.string().max(200).nullish(), body: z.string().min(1).max(4000),
    }).parse(req.body);
    const isCustomer = req.user!.baseRole === 'customer';
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const custId = isCustomer ? req.user!.customerId : b.customer_id;
      const channel = isCustomer ? 'portal' : b.channel;
      const thread = (await db.query(`INSERT INTO threads (tenant_id, customer_id, shipment_id, contact_name, channel, external_id, subject, last_message_preview, unread) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [t, custId ?? null, b.shipment_id ?? null, b.contact_name ?? req.user!.name, channel, b.external_id ?? null, b.subject ?? null, b.body.slice(0, 120), isCustomer ? 1 : 0])).rows[0];
      const msg = (await db.query(`INSERT INTO messages (tenant_id, thread_id, direction, sender, body, channel, status) VALUES ($1,$2,$3,$4,$5,$6,'sent') RETURNING *`, [t, thread.id, isCustomer ? 'in' : 'out', req.user!.name, b.body, channel])).rows[0];
      return { thread, msg };
    });
    if (!isCustomer) {
      const r = await sendOnChannel(req.user!.tenantId, out.thread.channel, out.thread.external_id, b.body, out.thread.subject);
      await query('UPDATE messages SET status=$2, external_id=COALESCE($3, external_id) WHERE id=$1', [out.msg.id, r.status, r.externalId ?? null]);
      out.msg.status = r.status;
      (out.msg as any).note = r.note;
    } else {
      await notifyPermitted(req.user!.tenantId, 'inbox', 'u', { title: `New portal message from ${req.user!.name}`, body: b.body.slice(0, 120), link: '/inbox' });
    }
    publish({ tenantId: req.user!.tenantId, type: 'message.created', entityType: 'thread', entityId: out.thread.id, userId: req.user!.id });
    res.status(201).json(out);
  }),
);

inboxRouter.post(
  '/threads/:id/messages',
  requirePerm('inbox', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ body: z.string().min(1).max(4000), note: z.boolean().optional() }).parse(req.body);
    const t = await loadThread(req, req.params.id);
    const isCustomer = req.user!.baseRole === 'customer';
    if (isCustomer && b.note) throw forbidden();
    const dir = isCustomer ? 'in' : b.note ? 'note' : 'out';
    let msg = (await one<any>({ query }, `INSERT INTO messages (tenant_id, thread_id, direction, sender, body, channel, status) VALUES ($1,$2,$3,$4,$5,$6,'sent') RETURNING *`, [req.user!.tenantId, t.id, dir, req.user!.name, b.body, t.channel]))!;
    await query('UPDATE threads SET last_message_at=now(), last_message_preview=$2, unread=CASE WHEN $3 THEN unread+1 ELSE 0 END, status=\'open\' WHERE id=$1', [t.id, b.body.slice(0, 120), isCustomer]);
    if (dir === 'out') {
      const r = await sendOnChannel(req.user!.tenantId, t.channel, t.external_id, b.body, t.subject);
      msg = (await one<any>({ query }, 'UPDATE messages SET status=$2, external_id=COALESCE($3, external_id) WHERE id=$1 RETURNING *', [msg.id, r.status, r.externalId ?? null]))!;
      (msg as any).delivery_note = r.note;
    }
    if (isCustomer) await notifyPermitted(req.user!.tenantId, 'inbox', 'u', { title: `Portal message from ${req.user!.name}`, body: b.body.slice(0, 120), link: '/inbox' });
    publish({ tenantId: req.user!.tenantId, type: 'message.created', entityType: 'thread', entityId: t.id, userId: req.user!.id });
    res.status(201).json(msg);
  }),
);

inboxRouter.patch(
  '/threads/:id',
  requirePerm('inbox', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ status: z.enum(['open', 'closed']).optional(), assigned_to: z.string().uuid().nullish(), customer_id: z.string().uuid().nullish(), shipment_id: z.string().uuid().nullish() }).parse(req.body);
    const row = await one({ query }, `UPDATE threads SET status=COALESCE($3,status), assigned_to=CASE WHEN $4::boolean THEN $5::uuid ELSE assigned_to END, customer_id=COALESCE($6,customer_id), shipment_id=COALESCE($7,shipment_id) WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [req.params.id, req.user!.tenantId, b.status ?? null, 'assigned_to' in b, b.assigned_to ?? null, b.customer_id ?? null, b.shipment_id ?? null]);
    if (!row) throw notFound();
    await auditFromReq(req, 'update', 'thread', req.params.id, b);
    res.json(row);
  }),
);

// ─────────────────────── WhatsApp Cloud API webhook (public) ───────────────────────
export const webhooksRouter = Router();

webhooksRouter.get('/whatsapp', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && typeof req.query['hub.verify_token'] === 'string' && timingSafeEq(String(req.query['hub.verify_token']), config.WHATSAPP_VERIFY_TOKEN)) {
    return res.status(200).send(String(req.query['hub.challenge'] ?? ''));
  }
  res.sendStatus(403);
});

webhooksRouter.post(
  '/whatsapp',
  wrap(async (req, res) => {
    // Authenticate the payload: Meta signs the raw body with the app secret (X-Hub-Signature-256).
    if (config.WHATSAPP_APP_SECRET) {
      const sig = String(req.headers['x-hub-signature-256'] || '').replace('sha256=', '');
      const expected = req.rawBody ? hmacSha256(config.WHATSAPP_APP_SECRET, req.rawBody) : '';
      if (!sig || !expected || !timingSafeEq(sig, expected)) return res.sendStatus(401);
    } else if (config.NODE_ENV === 'production') {
      logger.warn('WHATSAPP_APP_SECRET not set — refusing unsigned webhook in production');
      return res.sendStatus(401);
    }
    res.sendStatus(200); // ack fast; process after
    try {
      for (const entry of req.body?.entry || []) {
        for (const ch of entry.changes || []) {
          const v = ch.value || {};
          const phoneId = v.metadata?.phone_number_id;
          if (!phoneId) continue;
          const integ = await one<any>({ query }, `SELECT tenant_id FROM integrations WHERE provider='whatsapp' AND config->>'phone_id'=$1 LIMIT 1`, [phoneId]);
          if (!integ) continue;
          const tenantId: string = integ.tenant_id;
          for (const m of v.messages || []) {
            const from = waId(m.from);
            const body = m.text?.body || (m.type ? `[${m.type} message]` : '');
            if (!from || !body) continue;
            const name = v.contacts?.find((c: any) => waId(c.wa_id) === from)?.profile?.name || from;
            const contact = await one<any>({ query }, `SELECT customer_id FROM contacts WHERE tenant_id=$1 AND regexp_replace(COALESCE(whatsapp, phone, ''), '\\D', '', 'g') = $2 LIMIT 1`, [tenantId, from]);
            await tx(async (db) => {
              const dup = await one(db, 'SELECT 1 FROM messages WHERE tenant_id=$1 AND external_id=$2', [tenantId, m.id]);
              if (dup) return;
              let th = await one<any>(db, `SELECT * FROM threads WHERE tenant_id=$1 AND channel='whatsapp' AND external_id=$2 AND status='open' ORDER BY last_message_at DESC LIMIT 1`, [tenantId, from]);
              if (!th) {
                th = (await db.query(`INSERT INTO threads (tenant_id, customer_id, contact_name, channel, external_id, subject) VALUES ($1,$2,$3,'whatsapp',$4,$5) RETURNING *`, [tenantId, contact?.customer_id ?? null, name, from, contact ? null : 'Unknown sender — needs triage'])).rows[0];
              }
              await db.query(`INSERT INTO messages (tenant_id, thread_id, direction, sender, body, channel, status, external_id) VALUES ($1,$2,'in',$3,$4,'whatsapp','delivered',$5)`, [tenantId, th.id, name, body, m.id]);
              await db.query(`UPDATE threads SET last_message_at=now(), last_message_preview=$2, unread=unread+1 WHERE id=$1`, [th.id, body.slice(0, 120)]);
            });
            publish({ tenantId, type: 'message.received', entityType: 'thread', payload: { channel: 'whatsapp', from, body: body.slice(0, 200) } });
          }
          for (const s of v.statuses || []) {
            // delivery receipts
            await query(`UPDATE messages SET status=$3 WHERE external_id=$1 AND tenant_id=(SELECT tenant_id FROM integrations WHERE provider='whatsapp' AND config->>'phone_id'=$2 LIMIT 1)`, [s.id, phoneId, ['sent', 'delivered', 'read', 'failed'].includes(s.status) ? s.status : 'sent']);
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'whatsapp webhook processing failed');
    }
  }),
);
