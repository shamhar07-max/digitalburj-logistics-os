import { calcTotals, round2 } from '@digitalburj/shared';
import { Db, many, nextRef, one } from '../db';
import { badRequest, conflict, notFound } from '../lib/errors';
import { buildInvoiceXml, submitToAsp } from './einvoice';
import { postEntry, revenueAccountFor, reverseSource } from './ledger';
import { changeShipmentStatus } from './shipments';
import { getSettings } from './settings';
import { publish } from './events';
import { notify } from './notify';

const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

export async function createInvoiceFromCharges(
  db: Db,
  p: { tenantId: string; userId: string; entityId?: string | null; shipmentId: string; chargeIds?: string[]; issueDate?: string; dueDays?: number; notes?: string },
) {
  const s = await one<any>(db, 'SELECT * FROM shipments WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [p.shipmentId, p.tenantId]);
  if (!s) throw notFound('Shipment not found');
  if (!s.customer_id) throw badRequest('Shipment has no customer');
  const charges = await many<any>(
    db,
    `SELECT * FROM charges WHERE tenant_id=$1 AND shipment_id=$2 AND kind='revenue' AND invoice_id IS NULL ${p.chargeIds?.length ? 'AND id = ANY($3)' : ''} ORDER BY created_at`,
    p.chargeIds?.length ? [p.tenantId, p.shipmentId, p.chargeIds] : [p.tenantId, p.shipmentId],
  );
  if (!charges.length) throw badRequest('No unbilled revenue charges on this shipment');
  const cust = await one<any>(db, 'SELECT credit_days FROM customers WHERE id=$1', [s.customer_id]);
  const settings = await getSettings(db, p.tenantId);
  const issue = p.issueDate || today();
  const due = addDays(issue, p.dueDays ?? cust?.credit_days ?? settings.invoice_terms_days);
  const t = calcTotals(charges.map((c) => ({ description: c.description, quantity: Number(c.quantity), unit_price: Number(c.unit_amount), tax_code: c.tax_code })));
  const number = await nextRef(db, p.tenantId, 'invoice', 'INV-', 0, 8840);
  const inv = (
    await db.query(
      `INSERT INTO invoices (tenant_id, entity_id, number, customer_id, shipment_id, issue_date, due_date, currency, subtotal, vat, total, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'AED',$8,$9,$10,$11,$12) RETURNING *`,
      [p.tenantId, p.entityId ?? s.entity_id ?? null, number, s.customer_id, s.id, issue, due, t.subtotal, t.vat, t.total, p.notes ?? null, p.userId],
    )
  ).rows[0];
  for (const [i, c] of charges.entries()) {
    const r = t.rows[i];
    await db.query(`INSERT INTO invoice_items (tenant_id, invoice_id, charge_id, description, quantity, unit_price, tax_code, net, vat, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
      p.tenantId, inv.id, c.id, c.description, c.quantity, c.unit_amount, r.tax_code, r.net, r.vat, r.total,
    ]);
    await db.query(`UPDATE charges SET invoice_id=$2, status='billed' WHERE id=$1`, [c.id, inv.id]);
  }
  // shipment fully billed & delivered -> invoiced
  const left = await one<any>(db, `SELECT count(*)::int AS n FROM charges WHERE shipment_id=$1 AND kind='revenue' AND invoice_id IS NULL`, [s.id]);
  if (left!.n === 0 && s.status === 'delivered') await changeShipmentStatus(db, p.tenantId, p.userId, s.id, 'invoiced');
  return inv;
}

async function partyFor(db: Db, tenantId: string, inv: any) {
  const tenant = await one<any>(db, 'SELECT name, trn FROM tenants WHERE id=$1', [tenantId]);
  const ent = inv.entity_id ? await one<any>(db, 'SELECT name, trn FROM entities WHERE id=$1', [inv.entity_id]) : null;
  const cust = await one<any>(db, 'SELECT name, trn, email, address, city, country FROM customers WHERE id=$1', [inv.customer_id]);
  return {
    seller: { name: ent?.name || tenant.name, trn: ent?.trn || tenant.trn, country: 'AE' },
    buyer: { name: cust.name, trn: cust.trn, email: cust.email, address: cust.address, city: cust.city, country: cust.country || 'AE' },
  };
}

async function bankAccountId(db: Db, tenantId: string, preferred?: string | null) {
  if (preferred) {
    const a = await one<any>(db, 'SELECT id FROM accounts WHERE id=$1 AND tenant_id=$2 AND is_bank', [preferred, tenantId]);
    if (a) return a.id as string;
    throw badRequest('Unknown bank account');
  }
  const a = await one<any>(db, `SELECT id FROM accounts WHERE tenant_id=$1 AND is_bank ORDER BY code LIMIT 1`, [tenantId]);
  if (!a) throw badRequest('No bank account configured');
  return a.id as string;
}

/** Issue = lock, post to GL, generate XML, (optionally) transmit to the ASP. Idempotent for already-issued invoices. */
export async function issueInvoice(db: Db, tenantId: string, userId: string, invoiceId: string, opts: { submitAsp?: boolean } = {}) {
  const inv = await one<any>(db, 'SELECT * FROM invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [invoiceId, tenantId]);
  if (!inv) throw notFound('Invoice not found');
  if (inv.status === 'void') throw conflict('Invoice is void');
  const items = await many<any>(db, 'SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY id', [invoiceId]);
  if (inv.status === 'draft') {
    // group revenue by account
    const byAcct = new Map<string, number>();
    for (const it of items) {
      const ch = it.charge_id ? await one<any>(db, 'SELECT charge_type FROM charges WHERE id=$1', [it.charge_id]) : null;
      const acct = revenueAccountFor(ch?.charge_type);
      byAcct.set(acct, round2((byAcct.get(acct) || 0) + Number(it.net)));
    }
    await postEntry(db, {
      tenantId, entityId: inv.entity_id, date: String(inv.issue_date).slice(0, 10), memo: `Invoice ${inv.number}`, source: 'invoice', sourceId: inv.id, userId,
      lines: [
        { account: '1100', debit: Number(inv.total), memo: inv.number, customerId: inv.customer_id },
        ...[...byAcct.entries()].map(([account, credit]) => ({ account, credit })),
        { account: '2100', credit: Number(inv.vat), memo: 'Output VAT' },
      ],
    });
    const { seller, buyer } = await partyFor(db, tenantId, inv);
    const xml = buildInvoiceXml(inv, items, seller, buyer);
    await db.query(`UPDATE invoices SET status=CASE WHEN due_date < current_date THEN 'overdue' ELSE 'sent' END, sent_at=now(), xml=$2 WHERE id=$1`, [inv.id, xml]);
    publish({ tenantId, type: 'invoice.issued', entityType: 'invoice', entityId: inv.id, payload: { number: inv.number, total: inv.total, customer_id: inv.customer_id }, userId });
  }
  let row = (await db.query('SELECT * FROM invoices WHERE id=$1', [inv.id])).rows[0];
  if (opts.submitAsp && row.asp_status !== 'submitted' && row.asp_status !== 'accepted') {
    const res = await submitToAsp(row, row.xml);
    row = (await db.query(`UPDATE invoices SET asp_status=$2, asp_ref=$3, asp_submitted_at=now() WHERE id=$1 RETURNING *`, [row.id, res.status === 'rejected' ? 'rejected' : res.status, res.ref || null])).rows[0];
    row.asp_message = res.message;
    row.asp_sandbox = res.sandbox;
  }
  return row;
}

export async function recordReceipt(
  db: Db,
  p: { tenantId: string; userId: string; invoiceId: string; amount: number; method?: string; reference?: string; paidAt?: string; bankAccountId?: string | null },
) {
  const inv = await one<any>(db, 'SELECT * FROM invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [p.invoiceId, p.tenantId]);
  if (!inv) throw notFound('Invoice not found');
  if (inv.kind !== 'tax_invoice') throw badRequest('Payments apply to tax invoices');
  if (['draft', 'void'].includes(inv.status)) throw conflict(`Cannot receive payment on a ${inv.status} invoice`);
  const outstanding = round2(Number(inv.total) - Number(inv.paid));
  const amount = round2(p.amount);
  if (amount <= 0) throw badRequest('Amount must be positive');
  if (amount > outstanding + 0.005) throw badRequest(`Amount exceeds outstanding balance (AED ${outstanding.toFixed(2)})`);
  const bank = await bankAccountId(db, p.tenantId, p.bankAccountId);
  const number = await nextRef(db, p.tenantId, 'receipt', 'RCT-', 5, 0);
  const pay = (
    await db.query(
      `INSERT INTO payments (tenant_id, entity_id, number, kind, invoice_id, customer_id, amount, method, reference, paid_at, bank_account_id, created_by)
       VALUES ($1,$2,$3,'receipt',$4,$5,$6,$7,$8,COALESCE($9::date, current_date),$10,$11) RETURNING *`,
      [p.tenantId, inv.entity_id, number, inv.id, inv.customer_id, amount, p.method ?? 'bank_transfer', p.reference ?? null, p.paidAt ?? null, bank, p.userId],
    )
  ).rows[0];
  await postEntry(db, {
    tenantId: p.tenantId, entityId: inv.entity_id, date: String(pay.paid_at).slice(0, 10), memo: `Receipt ${number} for ${inv.number}`, source: 'payment', sourceId: pay.id, userId: p.userId,
    lines: [{ account: (await one<any>(db, 'SELECT code FROM accounts WHERE id=$1', [bank]))!.code, debit: amount }, { account: '1100', credit: amount, customerId: inv.customer_id }],
  });
  const paid = round2(Number(inv.paid) + amount);
  const full = round2(Number(inv.total) - paid) <= 0.005;
  const updated = (await db.query(`UPDATE invoices SET paid=$2, status=$3 WHERE id=$1 RETURNING *`, [inv.id, paid, full ? 'paid' : 'partial'])).rows[0];
  if (full) {
    await db.query(`UPDATE charges SET status='paid' WHERE invoice_id=$1`, [inv.id]);
    if (inv.shipment_id) {
      const open = await one<any>(db, `SELECT count(*)::int AS n FROM invoices WHERE shipment_id=$1 AND kind='tax_invoice' AND status NOT IN ('paid','void')`, [inv.shipment_id]);
      const sh = await one<any>(db, 'SELECT status FROM shipments WHERE id=$1', [inv.shipment_id]);
      if (open!.n === 0 && sh?.status === 'invoiced') await changeShipmentStatus(db, p.tenantId, p.userId, inv.shipment_id, 'closed');
    }
  }
  publish({ tenantId: p.tenantId, type: 'invoice.paid', entityType: 'invoice', entityId: inv.id, payload: { number: inv.number, amount, full, customer_id: inv.customer_id }, userId: p.userId });
  await notify(p.tenantId, { title: `${inv.number} ${full ? 'paid in full' : 'part-paid'} — AED ${amount.toLocaleString()}`, level: 'success', link: '/invoices' }, db);
  return { payment: pay, invoice: updated };
}

export async function voidInvoice(db: Db, tenantId: string, userId: string, invoiceId: string) {
  const inv = await one<any>(db, 'SELECT * FROM invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [invoiceId, tenantId]);
  if (!inv) throw notFound('Invoice not found');
  if (inv.status === 'void') return inv;
  if (Number(inv.paid) > 0) throw conflict('Invoice has payments. Issue a credit note instead.');
  if (inv.asp_status === 'submitted' || inv.asp_status === 'accepted') throw conflict('Invoice was submitted to the FTA/ASP. Issue a credit note instead.');
  await reverseSource(db, tenantId, 'invoice', inv.id, userId);
  await db.query(`UPDATE charges SET invoice_id=NULL, status='pending' WHERE invoice_id=$1`, [inv.id]);
  await db.query(`UPDATE shipments SET status='delivered' WHERE id=$1 AND status='invoiced'`, [inv.shipment_id]);
  return (await db.query(`UPDATE invoices SET status='void' WHERE id=$1 RETURNING *`, [inv.id])).rows[0];
}

/** Credit note for `amount` (gross); items are scaled proportionally from the original. Applied against the original invoice balance. */
export async function createCreditNote(db: Db, p: { tenantId: string; userId: string; invoiceId: string; amount?: number; reason?: string }) {
  const inv = await one<any>(db, 'SELECT * FROM invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [p.invoiceId, p.tenantId]);
  if (!inv) throw notFound('Invoice not found');
  if (inv.kind !== 'tax_invoice' || ['draft', 'void'].includes(inv.status)) throw conflict('Only issued tax invoices can be credited');
  const outstanding = round2(Number(inv.total) - Number(inv.paid));
  const amount = round2(p.amount ?? outstanding);
  if (amount <= 0) throw badRequest('Nothing to credit');
  if (amount > Number(inv.total) + 0.005) throw badRequest('Credit exceeds invoice total');
  const ratio = amount / Number(inv.total);
  const items = await many<any>(db, 'SELECT * FROM invoice_items WHERE invoice_id=$1', [inv.id]);
  const scaled = items.map((it) => ({ ...it, net: round2(Number(it.net) * ratio), vat: round2(Number(it.vat) * ratio) }));
  const subtotal = round2(scaled.reduce((s, i) => s + i.net, 0));
  const vat = round2(scaled.reduce((s, i) => s + i.vat, 0));
  const total = round2(subtotal + vat);
  const number = await nextRef(db, p.tenantId, 'credit_note', 'CN-', 5, 0);
  const cn = (
    await db.query(
      `INSERT INTO invoices (tenant_id, entity_id, number, kind, original_invoice_id, customer_id, shipment_id, issue_date, due_date, subtotal, vat, total, paid, status, notes, created_by)
       VALUES ($1,$2,$3,'credit_note',$4,$5,$6,current_date,current_date,$7,$8,$9,$9,'paid',$10,$11) RETURNING *`,
      [p.tenantId, inv.entity_id, number, inv.id, inv.customer_id, inv.shipment_id, subtotal, vat, total, p.reason ?? null, p.userId],
    )
  ).rows[0];
  const byAcct = new Map<string, number>();
  for (const it of scaled) {
    await db.query(`INSERT INTO invoice_items (tenant_id, invoice_id, charge_id, description, quantity, unit_price, tax_code, net, vat, total) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9)`, [
      p.tenantId, cn.id, it.description, it.quantity, it.unit_price, it.tax_code, it.net, it.vat, round2(it.net + it.vat),
    ]);
    const ch = it.charge_id ? await one<any>(db, 'SELECT charge_type FROM charges WHERE id=$1', [it.charge_id]) : null;
    const a = revenueAccountFor(ch?.charge_type);
    byAcct.set(a, round2((byAcct.get(a) || 0) + it.net));
  }
  await postEntry(db, {
    tenantId: p.tenantId, entityId: inv.entity_id, memo: `Credit note ${number} against ${inv.number}`, source: 'invoice', sourceId: cn.id, userId: p.userId,
    lines: [...[...byAcct.entries()].map(([account, debit]) => ({ account, debit })), { account: '2100', debit: vat, memo: 'Output VAT reversal' }, { account: '1100', credit: total, customerId: inv.customer_id }],
  });
  const paid = round2(Number(inv.paid) + total);
  await db.query(`UPDATE invoices SET paid=$2, status=$3 WHERE id=$1`, [inv.id, paid, round2(Number(inv.total) - paid) <= 0.005 ? 'paid' : 'partial']);
  const { seller, buyer } = await partyFor(db, p.tenantId, cn);
  await db.query('UPDATE invoices SET xml=$2 WHERE id=$1', [cn.id, buildInvoiceXml(cn, scaled.map((i) => ({ ...i, total: round2(i.net + i.vat) })), seller, buyer)]);
  return cn;
}
