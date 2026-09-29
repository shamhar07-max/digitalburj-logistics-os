import { Router } from 'express';
import { z } from 'zod';
import { ageingSummary, calcTotals, defaultTaxCode, round2 } from '@digitalburj/shared';
import { Db, many, nextRef, one, query, tx } from '../db';
import { requirePerm } from '../auth/middleware';
import { badRequest, conflict, notFound, wrap } from '../lib/errors';
import { auditFromReq } from '../services/audit';
import { balanceSheet, cashFlow, costAccountFor, generalLedger, postEntry, profitAndLoss, reverseSource, trialBalance } from '../services/ledger';
import { arAgeing } from './invoices';

export const accountingRouter = Router();
accountingRouter.use(requirePerm('accounting', 'r'));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((s) => s.slice(0, 10));
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + '01';
const yearStart = () => today().slice(0, 5) + '01-01';
const scope = (req: any) => ({ tenantId: req.user.tenantId, entityId: req.entityId });

accountingRouter.get(
  '/overview',
  wrap(async (req, res) => {
    const s = scope(req);
    const [cash, ar, ap, pl, bank] = await Promise.all([
      one<any>({ query }, `SELECT COALESCE(SUM(l.debit - l.credit),0) AS bal FROM journal_lines l JOIN accounts a ON a.id=l.account_id AND (a.is_bank OR a.subtype='cash') JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' WHERE l.tenant_id=$1`, [s.tenantId]),
      arAgeing(s.tenantId, s.entityId),
      many<any>({ query }, `SELECT due_date, total - paid AS outstanding FROM bills WHERE tenant_id=$1 AND status IN ('open','partial') AND total - paid > 0.005`, [s.tenantId]),
      profitAndLoss(s, monthStart(), today()),
      many<any>({ query }, `SELECT a.id, a.code, a.name, COALESCE(SUM(l.debit - l.credit),0) AS balance FROM accounts a LEFT JOIN journal_lines l ON l.account_id=a.id LEFT JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' WHERE a.tenant_id=$1 AND a.is_bank AND (l.id IS NULL OR e.id IS NOT NULL) GROUP BY a.id ORDER BY a.code`, [s.tenantId]),
    ]);
    res.json({
      cashPosition: round2(cash?.bal || 0),
      receivables: ar.total,
      payables: round2(ap.reduce((x, r) => x + Number(r.outstanding), 0)),
      apAgeing: ageingSummary(ap),
      arAgeing: ar.totals,
      mtd: { revenue: pl.totalRevenue, grossProfit: pl.grossProfit, netProfit: pl.netProfit, grossMarginPct: pl.grossMarginPct },
      bankAccounts: bank,
    });
  }),
);

accountingRouter.get('/trial-balance', wrap(async (req, res) => res.json(await trialBalance(scope(req), isoDate.catch(today()).parse(req.query.asOf)))));
accountingRouter.get('/pnl', wrap(async (req, res) => res.json(await profitAndLoss(scope(req), isoDate.catch(yearStart()).parse(req.query.from), isoDate.catch(today()).parse(req.query.to)))));
accountingRouter.get('/balance-sheet', wrap(async (req, res) => res.json(await balanceSheet(scope(req), isoDate.catch(today()).parse(req.query.asOf)))));
accountingRouter.get('/cash-flow', wrap(async (req, res) => res.json(await cashFlow(scope(req), isoDate.catch(yearStart()).parse(req.query.from), isoDate.catch(today()).parse(req.query.to)))));
accountingRouter.get(
  '/general-ledger',
  wrap(async (req, res) => {
    const acct = typeof req.query.account_id === 'string' && req.query.account_id ? req.query.account_id : null;
    res.json({ data: await generalLedger(scope(req), acct, isoDate.catch(monthStart()).parse(req.query.from), isoDate.catch(today()).parse(req.query.to)) });
  }),
);

accountingRouter.get(
  '/ar-ageing',
  requirePerm('invoices', 'r'),
  wrap(async (req, res) => res.json(await arAgeing(req.user!.tenantId, req.entityId))),
);

accountingRouter.get(
  '/ap-ageing',
  wrap(async (req, res) => {
    const rows = await many<any>({ query }, `SELECT b.id, b.number, b.due_date, b.total - b.paid AS outstanding, s.name AS supplier_name FROM bills b JOIN suppliers s ON s.id=b.supplier_id WHERE b.tenant_id=$1 AND b.status IN ('open','partial') AND b.total - b.paid > 0.005 ORDER BY b.due_date`, [req.user!.tenantId]);
    res.json({ totals: ageingSummary(rows), total: round2(rows.reduce((s, r) => s + Number(r.outstanding), 0)), bills: rows });
  }),
);

// ── Manual journals ──
accountingRouter.post(
  '/journal',
  requirePerm('accounting', 'c'),
  wrap(async (req, res) => {
    const b = z.object({
      date: isoDate.optional(), memo: z.string().min(2).max(300),
      lines: z.array(z.object({ account_id: z.string().uuid(), debit: z.coerce.number().min(0).default(0), credit: z.coerce.number().min(0).default(0), memo: z.string().max(200).optional() })).min(2),
    }).parse(req.body);
    const e = await tx(async (db) => {
      const ids = await many<any>(db, 'SELECT id, code FROM accounts WHERE tenant_id=$1 AND id = ANY($2)', [req.user!.tenantId, b.lines.map((l) => l.account_id)]);
      const code = new Map(ids.map((r) => [r.id, r.code]));
      if (b.lines.some((l) => !code.has(l.account_id))) throw badRequest('Unknown account in journal lines');
      const entry = await postEntry(db, {
        tenantId: req.user!.tenantId, entityId: req.entityId || req.user!.entityIds[0] || null, date: b.date, memo: b.memo, source: 'manual', userId: req.user!.id,
        lines: b.lines.map((l) => ({ account: code.get(l.account_id)!, debit: l.debit, credit: l.credit, memo: l.memo })),
      });
      await auditFromReq(req, 'create', 'journal', entry.id, { number: entry.number, memo: b.memo }, db);
      return entry;
    });
    res.status(201).json(e);
  }),
);

accountingRouter.get(
  '/journal/:id',
  wrap(async (req, res) => {
    const e = await one({ query }, 'SELECT * FROM journal_entries WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!e) throw notFound();
    const lines = await many({ query }, 'SELECT l.*, a.code, a.name AS account_name FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE l.entry_id=$1 ORDER BY l.debit DESC', [req.params.id]);
    res.json({ ...e, lines });
  }),
);

accountingRouter.post(
  '/journal/:id/reverse',
  requirePerm('accounting', 'd'),
  wrap(async (req, res) => {
    await tx(async (db) => {
      const e = await one<any>(db, `SELECT * FROM journal_entries WHERE id=$1 AND tenant_id=$2 AND status='posted' FOR UPDATE`, [req.params.id, req.user!.tenantId]);
      if (!e) throw notFound('Posted entry not found');
      if (e.source !== 'manual') throw conflict('System-generated entries are reversed by voiding the source document');
      const lines = await many<any>(db, `SELECT l.*, a.code FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE l.entry_id=$1`, [e.id]);
      await postEntry(db, { tenantId: e.tenant_id, entityId: e.entity_id, memo: `Reversal of ${e.number}`, source: 'manual', userId: req.user!.id, lines: lines.map((l) => ({ account: l.code, debit: l.credit, credit: l.debit, memo: l.memo })) });
      await db.query(`UPDATE journal_entries SET status='void' WHERE id=$1`, [e.id]);
      await auditFromReq(req, 'reverse', 'journal', e.id, {}, db);
    });
    res.json({ ok: true });
  }),
);

// ── Supplier bills (AP) ──
const billSchema = z.object({
  supplier_id: z.string().uuid(),
  shipment_id: z.string().uuid().nullish(),
  supplier_ref: z.string().max(80).optional(),
  bill_date: isoDate.optional(),
  due_date: isoDate.optional(),
  charge_ids: z.array(z.string().uuid()).optional(),
  items: z.array(z.object({ description: z.string().min(1), charge_type: z.string().default('other'), amount: z.coerce.number().positive(), tax_code: z.enum(['S', 'Z', 'E', 'O']).optional() })).optional(),
});

accountingRouter.post(
  '/bills',
  requirePerm('accounting', 'c'),
  wrap(async (req, res) => {
    const b = billSchema.parse(req.body);
    const bill = await tx(async (db) => {
      const t = req.user!.tenantId;
      const sup = await one<any>(db, 'SELECT * FROM suppliers WHERE id=$1 AND tenant_id=$2', [b.supplier_id, t]);
      if (!sup) throw badRequest('Unknown supplier');
      let lines: { description: string; charge_type: string; amount: number; tax_code: any }[] = (b.items || []).map((i) => ({ description: i.description, charge_type: i.charge_type, amount: i.amount, tax_code: i.tax_code || defaultTaxCode(i.charge_type) }));
      let chargeRows: any[] = [];
      if (b.charge_ids?.length) {
        chargeRows = await many<any>(db, `SELECT * FROM charges WHERE tenant_id=$1 AND id = ANY($2) AND kind='cost' AND bill_id IS NULL`, [t, b.charge_ids]);
        if (chargeRows.length !== b.charge_ids.length) throw badRequest('Some cost charges are missing or already billed');
        lines = lines.concat(chargeRows.map((c) => ({ description: c.description, charge_type: c.charge_type, amount: Number(c.amount_aed), tax_code: c.tax_code })));
      }
      if (!lines.length) throw badRequest('Provide items or charge_ids');
      const tot = calcTotals(lines.map((l) => ({ description: l.description, quantity: 1, unit_price: l.amount, tax_code: l.tax_code })));
      const number = await nextRef(db, t, 'bill', 'BILL-', 5, 0);
      const bd = b.bill_date || today();
      const due = b.due_date || new Date(Date.parse(bd) + sup.payment_days * 86_400_000).toISOString().slice(0, 10);
      const row = (await db.query(
        `INSERT INTO bills (tenant_id, entity_id, number, supplier_id, shipment_id, supplier_ref, bill_date, due_date, subtotal, vat, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [t, req.entityId || req.user!.entityIds[0] || null, number, sup.id, b.shipment_id ?? chargeRows[0]?.shipment_id ?? null, b.supplier_ref ?? null, bd, due, tot.subtotal, tot.vat, tot.total],
      )).rows[0];
      if (chargeRows.length) await db.query(`UPDATE charges SET bill_id=$2, status='billed' WHERE id = ANY($1)`, [chargeRows.map((c) => c.id), row.id]);
      const byAcct = new Map<string, number>();
      lines.forEach((l, i) => {
        const a = costAccountFor(l.charge_type);
        byAcct.set(a, round2((byAcct.get(a) || 0) + tot.rows[i].net));
      });
      await postEntry(db, {
        tenantId: t, entityId: row.entity_id, date: bd, memo: `Bill ${number} — ${sup.name}`, source: 'bill', sourceId: row.id, userId: req.user!.id,
        lines: [...[...byAcct.entries()].map(([account, debit]) => ({ account, debit })), { account: '1200', debit: tot.vat, memo: 'Input VAT' }, { account: '2000', credit: tot.total, supplierId: sup.id }],
      });
      await auditFromReq(req, 'create', 'bill', row.id, { number, total: tot.total }, db);
      return row;
    });
    res.status(201).json(bill);
  }),
);

accountingRouter.post(
  '/bills/:id/pay',
  requirePerm('accounting', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ amount: z.coerce.number().positive(), bank_account_id: z.string().uuid(), method: z.string().default('bank_transfer'), reference: z.string().max(100).optional(), paid_at: isoDate.optional() }).parse(req.body);
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const bill = await one<any>(db, 'SELECT * FROM bills WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, t]);
      if (!bill) throw notFound();
      const outstanding = round2(bill.total - bill.paid);
      if (b.amount > outstanding + 0.005) throw badRequest(`Amount exceeds outstanding (AED ${outstanding})`);
      const bank = await one<any>(db, 'SELECT code FROM accounts WHERE id=$1 AND tenant_id=$2 AND is_bank', [b.bank_account_id, t]);
      if (!bank) throw badRequest('Unknown bank account');
      const number = await nextRef(db, t, 'payment', 'PAY-', 5, 0);
      const pay = (await db.query(`INSERT INTO payments (tenant_id, entity_id, number, kind, bill_id, supplier_id, amount, method, reference, paid_at, bank_account_id, created_by) VALUES ($1,$2,$3,'payment',$4,$5,$6,$7,$8,COALESCE($9::date,current_date),$10,$11) RETURNING *`,
        [t, bill.entity_id, number, bill.id, bill.supplier_id, b.amount, b.method, b.reference ?? null, b.paid_at ?? null, b.bank_account_id, req.user!.id])).rows[0];
      await postEntry(db, { tenantId: t, entityId: bill.entity_id, date: String(pay.paid_at).slice(0, 10), memo: `Payment ${number} for ${bill.number}`, source: 'payment', sourceId: pay.id, userId: req.user!.id,
        lines: [{ account: '2000', debit: b.amount, supplierId: bill.supplier_id }, { account: bank.code, credit: b.amount }] });
      const paid = round2(bill.paid + b.amount);
      const full = round2(bill.total - paid) <= 0.005;
      const row = (await db.query(`UPDATE bills SET paid=$2, status=$3 WHERE id=$1 RETURNING *`, [bill.id, paid, full ? 'paid' : 'partial'])).rows[0];
      if (full) await db.query(`UPDATE charges SET status='paid' WHERE bill_id=$1`, [bill.id]);
      await auditFromReq(req, 'pay', 'bill', bill.id, { amount: b.amount }, db);
      return { bill: row, payment: pay };
    });
    res.status(201).json(out);
  }),
);

// ── Bank reconciliation ──
accountingRouter.post(
  '/bank/import',
  requirePerm('accounting', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ account_id: z.string().uuid(), rows: z.array(z.object({ date: isoDate, description: z.string().max(300).optional(), amount: z.coerce.number().refine((n) => n !== 0), reference: z.string().max(100).optional() })).min(1).max(2000) }).parse(req.body);
    const n = await tx(async (db) => {
      const a = await one(db, 'SELECT 1 FROM accounts WHERE id=$1 AND tenant_id=$2 AND is_bank', [b.account_id, req.user!.tenantId]);
      if (!a) throw badRequest('Unknown bank account');
      let inserted = 0;
      for (const r of b.rows) {
        // de-duplicate re-imports of the same statement line
        const dup = await one(db, 'SELECT 1 FROM bank_transactions WHERE tenant_id=$1 AND account_id=$2 AND txn_date=$3 AND amount=$4 AND COALESCE(reference,\'\')=COALESCE($5,\'\') AND COALESCE(description,\'\')=COALESCE($6,\'\')', [req.user!.tenantId, b.account_id, r.date, r.amount, r.reference ?? null, r.description ?? null]);
        if (dup) continue;
        await db.query('INSERT INTO bank_transactions (tenant_id, account_id, txn_date, description, amount, reference) VALUES ($1,$2,$3,$4,$5,$6)', [req.user!.tenantId, b.account_id, r.date, r.description ?? null, r.amount, r.reference ?? null]);
        inserted++;
      }
      return inserted;
    });
    res.status(201).json({ imported: n });
  }),
);

/** Auto-match unmatched statement lines to system receipts/payments (same amount, ±7 days, reference hint boosts). */
accountingRouter.post(
  '/bank/auto-match',
  requirePerm('accounting', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ account_id: z.string().uuid() }).parse(req.body);
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const lines = await many<any>(db, `SELECT * FROM bank_transactions WHERE tenant_id=$1 AND account_id=$2 AND status='unmatched' ORDER BY txn_date`, [t, b.account_id]);
      let matched = 0;
      for (const l of lines) {
        const cands = await many<any>(db, `
          SELECT p.id, p.number, p.reference, p.paid_at,
                 (CASE WHEN $6::text <> '' AND (lower(COALESCE(p.reference,'')) LIKE '%' || lower($6::text) || '%' OR lower($5::text) LIKE '%' || lower(p.number) || '%') THEN 1 ELSE 0 END) AS ref_hit,
                 abs(p.paid_at - $4::date) AS gap
            FROM payments p
           WHERE p.tenant_id=$1 AND p.bank_account_id=$2 AND p.kind = CASE WHEN $3::numeric > 0 THEN 'receipt' ELSE 'payment' END AND p.amount = abs($3::numeric)
             AND abs(p.paid_at - $4::date) <= 7
             AND NOT EXISTS (SELECT 1 FROM bank_transactions x WHERE x.matched_payment_id=p.id)
           ORDER BY ref_hit DESC, gap ASC LIMIT 1`, [t, b.account_id, l.amount, l.txn_date, l.description || '', l.reference || '']);
        if (cands[0]) {
          await db.query(`UPDATE bank_transactions SET matched_payment_id=$2, status='matched' WHERE id=$1`, [l.id, cands[0].id]);
          matched++;
        }
      }
      return { scanned: lines.length, matched };
    });
    res.json(out);
  }),
);

accountingRouter.post(
  '/bank/:id/match',
  requirePerm('accounting', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ payment_id: z.string().uuid().nullish(), ignore: z.boolean().optional() }).parse(req.body);
    const t = req.user!.tenantId;
    if (b.ignore) {
      await query(`UPDATE bank_transactions SET status='ignored', matched_payment_id=NULL WHERE id=$1 AND tenant_id=$2`, [req.params.id, t]);
      return res.json({ ok: true });
    }
    if (!b.payment_id) throw badRequest('payment_id required');
    const pay =await one({ query }, 'SELECT id FROM payments WHERE id=$1 AND tenant_id=$2', [b.payment_id, t]);
    if (!pay) throw notFound('Payment not found');
    await query(`UPDATE bank_transactions SET status='matched', matched_payment_id=$3 WHERE id=$1 AND tenant_id=$2`, [req.params.id, t, b.payment_id]);
    res.json({ ok: true });
  }),
);

accountingRouter.get(
  '/bank/summary',
  wrap(async (req, res) => {
    const acct = z.string().uuid().parse(req.query.account_id);
    const t = req.user!.tenantId;
    const [book, stmt, unmatched] = await Promise.all([
      one<any>({ query }, `SELECT COALESCE(SUM(l.debit - l.credit),0) AS bal FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' WHERE l.tenant_id=$1 AND l.account_id=$2`, [t, acct]),
      one<any>({ query }, `SELECT COALESCE(SUM(amount),0) AS bal, count(*) FILTER (WHERE status='unmatched')::int AS unmatched FROM bank_transactions WHERE tenant_id=$1 AND account_id=$2 AND status <> 'ignored'`, [t, acct]),
      many({ query }, `SELECT p.id, p.number, p.kind, p.amount, p.paid_at, p.reference FROM payments p WHERE p.tenant_id=$1 AND p.bank_account_id=$2 AND NOT EXISTS (SELECT 1 FROM bank_transactions x WHERE x.matched_payment_id=p.id) ORDER BY p.paid_at DESC LIMIT 100`, [t, acct]),
    ]);
    res.json({ bookBalance: round2(book!.bal), statementNet: round2(stmt!.bal), unmatchedLines: stmt!.unmatched, difference: round2(book!.bal - stmt!.bal), unreconciledPayments: unmatched });
  }),
);

// ── UAE VAT return (FTA VAT201-style summary) ──
accountingRouter.get(
  '/vat',
  requirePerm('vat', 'r'),
  wrap(async (req, res) => {
    const from = isoDate.catch(monthStart()).parse(req.query.from);
    const to = isoDate.catch(today()).parse(req.query.to);
    const t = req.user!.tenantId;
    const params: any[] = [t, from, to];
    let ent = '';
    if (req.entityId) {
      params.push(req.entityId);
      ent = ` AND (i.entity_id=$4 OR i.entity_id IS NULL)`;
    }
    const sales = await many<any>({ query }, `
      SELECT ii.tax_code, SUM(CASE WHEN i.kind='credit_note' THEN -ii.net ELSE ii.net END) AS net, SUM(CASE WHEN i.kind='credit_note' THEN -ii.vat ELSE ii.vat END) AS vat
        FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id
       WHERE i.tenant_id=$1 AND i.status <> 'draft' AND i.status <> 'void' AND i.issue_date BETWEEN $2::date AND $3::date ${ent} GROUP BY ii.tax_code`, params);
    const inputs = await one<any>({ query }, `SELECT COALESCE(SUM(subtotal),0) AS net, COALESCE(SUM(vat),0) AS vat FROM bills WHERE tenant_id=$1 AND bill_date BETWEEN $2::date AND $3::date`, [t, from, to]);
    const g = (c: string, k: 'net' | 'vat') => round2(sales.find((s) => s.tax_code === c)?.[k] || 0);
    const outputVat = round2(sales.reduce((x, s) => x + Number(s.vat), 0));
    const invoices = await many({ query }, `SELECT i.number, i.kind, i.issue_date, i.subtotal, i.vat, i.asp_status, (SELECT name FROM customers c WHERE c.id=i.customer_id) AS customer_name
        FROM invoices i WHERE i.tenant_id=$1 AND i.status NOT IN ('draft','void') AND i.issue_date BETWEEN $2::date AND $3::date ${ent} ORDER BY i.issue_date DESC LIMIT 500`, params);
    res.json({
      period: { from, to },
      boxes: {
        standardRatedSupplies: { net: g('S', 'net'), vat: g('S', 'vat') },
        zeroRatedSupplies: g('Z', 'net'),
        exemptSupplies: g('E', 'net'),
        outOfScope: g('O', 'net'),
        totalOutputVat: outputVat,
        inputVat: round2(inputs!.vat),
        inputNet: round2(inputs!.net),
        netVatPayable: round2(outputVat - Number(inputs!.vat)),
      },
      invoices,
      note: 'Summary aligned with FTA VAT201 boxes for review. Reconcile before filing via the EmaraTax portal.',
    });
  }),
);
