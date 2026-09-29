import { Router } from 'express';
import { z } from 'zod';
import { ageingSummary, round2 } from '@digitalburj/shared';
import { many, one, query, tx } from '../db';
import { portalScope, requirePerm } from '../auth/middleware';
import { notFound, wrap } from '../lib/errors';
import { isUuid } from '../crud/validate';
import { auditFromReq } from '../services/audit';
import { createCreditNote, createInvoiceFromCharges, issueInvoice, recordReceipt, voidInvoice } from '../services/invoicing';
import { submitToAsp } from '../services/einvoice';

export const invoicesRouter = Router();

/** Shipments with billable (unbilled) revenue — the "ready to invoice" queue. */
invoicesRouter.get(
  '/unbilled',
  requirePerm('invoices', 'r'),
  wrap(async (req, res) => {
    const rows = await many({ query }, `
      SELECT s.id, s.number, s.status, s.delivered_at, s.customer_id, c.name AS customer_name, c.status AS customer_status,
             SUM(ch.amount_aed) AS unbilled, count(*)::int AS lines,
             EXISTS (SELECT 1 FROM pods p WHERE p.shipment_id=s.id) AS has_pod
        FROM charges ch JOIN shipments s ON s.id=ch.shipment_id LEFT JOIN customers c ON c.id=s.customer_id
       WHERE ch.tenant_id=$1 AND ch.kind='revenue' AND ch.invoice_id IS NULL AND s.status NOT IN ('cancelled')
       GROUP BY s.id, c.name, c.status ORDER BY (s.status='delivered') DESC, s.delivered_at NULLS LAST`, [req.user!.tenantId]);
    res.json({ data: rows });
  }),
);

invoicesRouter.post(
  '/from-shipment/:shipmentId',
  requirePerm('invoices', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ charge_ids: z.array(z.string().uuid()).optional(), issue_date: z.string().optional(), due_days: z.coerce.number().int().min(0).max(365).optional(), notes: z.string().max(1000).optional(), issue: z.boolean().optional() }).parse(req.body || {});
    const inv = await tx(async (db) => {
      const draft = await createInvoiceFromCharges(db, {
        tenantId: req.user!.tenantId, userId: req.user!.id, entityId: req.entityId, shipmentId: req.params.shipmentId, chargeIds: b.charge_ids, issueDate: b.issue_date?.slice(0, 10), dueDays: b.due_days, notes: b.notes,
      });
      await auditFromReq(req, 'create', 'invoice', draft.id, { number: draft.number, total: draft.total }, db);
      return b.issue ? issueInvoice(db, req.user!.tenantId, req.user!.id, draft.id) : draft;
    });
    res.status(201).json(inv);
  }),
);

async function loadDetail(req: any, id: string) {
  if (!isUuid(id)) throw notFound();
  const cust = portalScope(req);
  const inv = await one<any>({ query }, `SELECT i.*, (SELECT name FROM customers c WHERE c.id=i.customer_id) AS customer_name, (SELECT number FROM shipments s WHERE s.id=i.shipment_id) AS shipment_number
      FROM invoices i WHERE i.tenant_id=$1 AND i.id=$2 ${cust ? 'AND i.customer_id=$3 AND i.status <> \'draft\'' : ''}`, cust ? [req.user.tenantId, id, cust] : [req.user.tenantId, id]);
  if (!inv) throw notFound();
  const [items, payments] = await Promise.all([
    many({ query }, 'SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY id', [id]),
    many({ query }, 'SELECT id, number, amount, method, reference, paid_at FROM payments WHERE invoice_id=$1 ORDER BY paid_at', [id]),
  ]);
  return { ...inv, xml: undefined, has_xml: !!inv.xml, items, payments, outstanding: round2(inv.total - inv.paid) };
}

invoicesRouter.get('/:id/detail', requirePerm('invoices', 'r'), wrap(async (req, res) => res.json(await loadDetail(req, req.params.id))));

invoicesRouter.post(
  '/:id/send',
  requirePerm('invoices', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ submit_asp: z.boolean().optional() }).parse(req.body || {});
    const row = await tx(async (db) => {
      const r = await issueInvoice(db, req.user!.tenantId, req.user!.id, req.params.id, { submitAsp: b.submit_asp !== false });
      await auditFromReq(req, 'issue', 'invoice', r.id, { number: r.number, asp: r.asp_status }, db);
      return r;
    });
    res.json(row);
  }),
);

invoicesRouter.post(
  '/:id/payments',
  requirePerm('invoices', 'u'),
  requirePerm('accounting', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ amount: z.coerce.number().positive(), method: z.enum(['bank_transfer', 'cheque', 'cash', 'card', 'online']).optional(), reference: z.string().max(100).optional(), paid_at: z.string().optional(), bank_account_id: z.string().uuid().nullish() }).parse(req.body);
    const out = await tx(async (db) => {
      const r = await recordReceipt(db, { tenantId: req.user!.tenantId, userId: req.user!.id, invoiceId: req.params.id, amount: b.amount, method: b.method, reference: b.reference, paidAt: b.paid_at?.slice(0, 10), bankAccountId: b.bank_account_id });
      await auditFromReq(req, 'receipt', 'invoice', req.params.id, { amount: b.amount, ref: r.payment.number }, db);
      return r;
    });
    res.status(201).json(out);
  }),
);

invoicesRouter.post(
  '/:id/void',
  requirePerm('invoices', 'd'),
  wrap(async (req, res) => {
    const row = await tx(async (db) => {
      const r = await voidInvoice(db, req.user!.tenantId, req.user!.id, req.params.id);
      await auditFromReq(req, 'void', 'invoice', r.id, {}, db);
      return r;
    });
    res.json(row);
  }),
);

invoicesRouter.post(
  '/:id/credit-note',
  requirePerm('invoices', 'a'),
  wrap(async (req, res) => {
    const b = z.object({ amount: z.coerce.number().positive().optional(), reason: z.string().max(500).optional() }).parse(req.body || {});
    const row = await tx(async (db) => {
      const r = await createCreditNote(db, { tenantId: req.user!.tenantId, userId: req.user!.id, invoiceId: req.params.id, amount: b.amount, reason: b.reason });
      await auditFromReq(req, 'credit_note', 'invoice', req.params.id, { number: r.number, total: r.total, reason: b.reason }, db);
      return r;
    });
    res.status(201).json(row);
  }),
);

invoicesRouter.post(
  '/:id/asp-submit',
  requirePerm('invoices', 'u'),
  wrap(async (req, res) => {
    const inv = await one<any>({ query }, 'SELECT * FROM invoices WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!inv) throw notFound();
    if (!inv.xml) throw notFound('Invoice has not been issued yet');
    const r = await submitToAsp(inv, inv.xml);
    const row = await one({ query }, `UPDATE invoices SET asp_status=$2, asp_ref=$3, asp_submitted_at=now() WHERE id=$1 RETURNING id, number, asp_status, asp_ref, asp_submitted_at`, [inv.id, r.status, r.ref || null]);
    await auditFromReq(req, 'asp_submit', 'invoice', inv.id, r);
    res.json({ ...row, sandbox: r.sandbox, message: r.message });
  }),
);

invoicesRouter.get(
  '/:id/xml',
  requirePerm('invoices', 'r'),
  wrap(async (req, res) => {
    const inv = await one<any>({ query }, 'SELECT number, xml FROM invoices WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!inv?.xml) throw notFound();
    res.type('application/xml').set('Content-Disposition', `attachment; filename="${inv.number}.xml"`).send(inv.xml);
  }),
);

const esc = (s: any) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);
const money = (n: any) => Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Print-ready tax invoice (browser "Save as PDF"). Authenticated via bearer or ?access_token=. */
invoicesRouter.get(
  '/:id/print',
  requirePerm('invoices', 'r'),
  wrap(async (req, res) => {
    const inv: any = await loadDetail(req, req.params.id);
    const tenant = await one<any>({ query }, 'SELECT name, trn, trade_license FROM tenants WHERE id=$1', [req.user!.tenantId]);
    const cust = await one<any>({ query }, 'SELECT name, trn, address, city, email FROM customers WHERE id=$1', [inv.customer_id]);
    const title = inv.kind === 'credit_note' ? 'CREDIT NOTE' : 'TAX INVOICE';
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.number)}</title>
<style>body{font:13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#222;max-width:820px;margin:24px auto;padding:0 20px}
h1{font-size:22px;margin:0;color:#0A2A2B}.row{display:flex;justify-content:space-between;gap:20px}.muted{color:#777}table{width:100%;border-collapse:collapse;margin:18px 0}
th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f5f0;font-size:11px;text-transform:uppercase}td.n,th.n{text-align:right}
.tot td{border:none;padding:3px 8px}.big{font-size:16px;font-weight:800}@media print{button{display:none}}</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 14px">Print / Save PDF</button>
<div class="row"><div><h1>${esc(tenant.name)}</h1><div class="muted">TRN: ${esc(tenant.trn || '—')}</div></div><div style="text-align:right"><h1 style="color:#E8472B">${title}</h1><div><b>${esc(inv.number)}</b></div>
<div class="muted">Issued ${esc(String(inv.issue_date).slice(0, 10))}${inv.kind === 'credit_note' ? '' : ' · Due ' + esc(String(inv.due_date).slice(0, 10))}</div></div></div>
<div style="margin-top:22px"><div class="muted">Bill to</div><b>${esc(cust?.name)}</b><br>TRN: ${esc(cust?.trn || '—')}<br>${esc(cust?.address || '')} ${esc(cust?.city || '')}</div>
${inv.shipment_number ? `<div class="muted" style="margin-top:8px">Shipment ${esc(inv.shipment_number)}</div>` : ''}
<table><thead><tr><th>#</th><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th>VAT</th><th class="n">Net (AED)</th><th class="n">VAT (AED)</th><th class="n">Total (AED)</th></tr></thead><tbody>
${inv.items.map((i: any, n: number) => `<tr><td>${n + 1}</td><td>${esc(i.description)}</td><td class="n">${Number(i.quantity)}</td><td class="n">${money(i.unit_price)}</td><td>${esc(i.tax_code)}</td><td class="n">${money(i.net)}</td><td class="n">${money(i.vat)}</td><td class="n">${money(i.total)}</td></tr>`).join('')}
</tbody></table>
<table class="tot" style="width:320px;margin-left:auto"><tr><td>Subtotal</td><td class="n">${money(inv.subtotal)}</td></tr><tr><td>VAT</td><td class="n">${money(inv.vat)}</td></tr>
<tr class="big"><td>Total AED</td><td class="n">${money(inv.total)}</td></tr><tr><td>Paid</td><td class="n">${money(inv.paid)}</td></tr><tr class="big"><td>Balance due</td><td class="n">${money(inv.outstanding)}</td></tr></table>
<p class="muted">Tax codes: S = 5% standard · Z = zero-rated (international transport) · E = exempt · O = out of scope (disbursement).</p></body></html>`);
  }),
);

/** AR ageing (also used by reports + dashboard). */
export async function arAgeing(tenantId: string, entityId?: string | null) {
  const rows = await many<any>(
    { query },
    `SELECT i.id, i.number, i.due_date, i.total - i.paid AS outstanding, c.id AS customer_id, c.name AS customer_name
       FROM invoices i JOIN customers c ON c.id=i.customer_id
      WHERE i.tenant_id=$1 AND i.kind='tax_invoice' AND i.status IN ('sent','partial','overdue') AND i.total - i.paid > 0.005 ${entityId ? 'AND (i.entity_id=$2 OR i.entity_id IS NULL)' : ''}`,
    entityId ? [tenantId, entityId] : [tenantId],
  );
  const perCustomer = new Map<string, any>();
  for (const r of rows) {
    const cur = perCustomer.get(r.customer_id) || { customer_id: r.customer_id, customer_name: r.customer_name, invoices: [] as any[] };
    cur.invoices.push(r);
    perCustomer.set(r.customer_id, cur);
  }
  const customers = [...perCustomer.values()].map((c) => ({ ...c, total: round2(c.invoices.reduce((s: number, i: any) => s + i.outstanding, 0)), buckets: ageingSummary(c.invoices) })).sort((a, b) => b.total - a.total);
  return { totals: ageingSummary(rows), total: round2(rows.reduce((s, r) => s + r.outstanding, 0)), customers };
}
