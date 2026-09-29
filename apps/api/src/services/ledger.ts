import { round2 } from '@digitalburj/shared';
import { Db, many, nextRef, one, query } from '../db';
import { badRequest } from '../lib/errors';

export interface JLine {
  account: string; // account code
  debit?: number;
  credit?: number;
  memo?: string;
  customerId?: string | null;
  supplierId?: string | null;
}

export function revenueAccountFor(chargeType?: string | null): string {
  switch ((chargeType || '').toLowerCase()) {
    case 'customs_clearance':
    case 'duty':
    case 'documentation':
      return '4100';
    case 'trucking':
      return '4200';
    case 'storage':
    case 'handling':
      return '4300';
    case 'freight':
    case 'thc':
    case 'baf':
    case 'demurrage':
    case 'detention':
      return '4000';
    default:
      return '4900';
  }
}
export function costAccountFor(chargeType?: string | null): string {
  switch ((chargeType || '').toLowerCase()) {
    case 'customs_clearance':
    case 'duty':
    case 'documentation':
      return '5100';
    case 'trucking':
      return '5200';
    case 'storage':
    case 'handling':
      return '5300';
    case 'freight':
    case 'thc':
    case 'baf':
    case 'demurrage':
    case 'detention':
      return '5000';
    default:
      return '5900';
  }
}

async function accountIds(db: Db, tenantId: string, codes: string[]) {
  const rows = await many<{ id: string; code: string }>(db, 'SELECT id, code FROM accounts WHERE tenant_id=$1 AND code = ANY($2)', [tenantId, [...new Set(codes)]]);
  const map = new Map(rows.map((r) => [r.code, r.id]));
  for (const c of codes) if (!map.has(c)) throw badRequest(`Account ${c} is missing from the chart of accounts`);
  return map;
}

/** Post a balanced journal entry. Throws if debits != credits. */
export async function postEntry(
  db: Db,
  p: { tenantId: string; entityId?: string | null; date?: string; memo?: string; source?: string; sourceId?: string | null; userId?: string | null; lines: JLine[] },
) {
  const lines = p.lines.filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0).map((l) => ({ ...l, debit: round2(l.debit || 0), credit: round2(l.credit || 0) }));
  if (lines.length < 2) throw badRequest('A journal entry needs at least two lines');
  const dr = round2(lines.reduce((s, l) => s + l.debit, 0));
  const cr = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (dr !== cr) throw badRequest(`Journal entry is not balanced (debits ${dr} ≠ credits ${cr})`);
  const ids = await accountIds(db, p.tenantId, lines.map((l) => l.account));
  const number = await nextRef(db, p.tenantId, 'journal', 'JE-', 5, 0);
  const e = (
    await db.query(
      `INSERT INTO journal_entries (tenant_id, entity_id, number, entry_date, memo, source, source_id, created_by)
       VALUES ($1,$2,$3,COALESCE($4::date, current_date),$5,$6,$7,$8) RETURNING *`,
      [p.tenantId, p.entityId ?? null, number, p.date ?? null, p.memo ?? null, p.source ?? 'manual', p.sourceId ?? null, p.userId ?? null],
    )
  ).rows[0];
  for (const l of lines) {
    await db.query(`INSERT INTO journal_lines (tenant_id, entry_id, account_id, debit, credit, memo, customer_id, supplier_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
      p.tenantId, e.id, ids.get(l.account), l.debit, l.credit, l.memo ?? null, l.customerId ?? null, l.supplierId ?? null,
    ]);
  }
  return e;
}

/** Reverse all posted entries for a source document (used when voiding). */
export async function reverseSource(db: Db, tenantId: string, source: string, sourceId: string, userId?: string | null) {
  const entries = await many<any>(db, `SELECT * FROM journal_entries WHERE tenant_id=$1 AND source=$2 AND source_id=$3 AND status='posted'`, [tenantId, source, sourceId]);
  for (const e of entries) {
    const lines = await many<any>(db, `SELECT l.*, a.code FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE l.entry_id=$1`, [e.id]);
    await postEntry(db, {
      tenantId, entityId: e.entity_id, memo: `Reversal of ${e.number}`, source: source + '_reversal', sourceId, userId,
      lines: lines.map((l) => ({ account: l.code, debit: l.credit, credit: l.debit, memo: l.memo, customerId: l.customer_id, supplierId: l.supplier_id })),
    });
    await db.query(`UPDATE journal_entries SET status='void' WHERE id=$1`, [e.id]);
  }
}

// ───────────────────────── Reports ─────────────────────────
interface Scope {
  tenantId: string;
  entityId?: string | null;
}
const entClause = (s: Scope, params: any[]) => {
  if (!s.entityId) return '';
  params.push(s.entityId);
  return ` AND (e.entity_id = $${params.length} OR e.entity_id IS NULL)`;
};

export async function trialBalance(s: Scope, asOf: string) {
  const params: any[] = [s.tenantId, asOf];
  const ent = entClause(s, params);
  const rows = await many<any>(
    { query },
    `SELECT a.id, a.code, a.name, a.type,
            COALESCE(SUM(l.debit),0) AS debit, COALESCE(SUM(l.credit),0) AS credit
       FROM accounts a
       LEFT JOIN journal_lines l ON l.account_id=a.id
       LEFT JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.entry_date <= $2::date ${ent}
      WHERE a.tenant_id=$1
        AND (l.id IS NULL OR e.id IS NOT NULL)
      GROUP BY a.id ORDER BY a.code`,
    params,
  );
  const lines = rows.map((r) => {
    const net = round2(r.debit - r.credit);
    return { ...r, debit: round2(r.debit), credit: round2(r.credit), balance_debit: net > 0 ? net : 0, balance_credit: net < 0 ? -net : 0 };
  });
  return {
    asOf,
    lines: lines.filter((l) => l.debit || l.credit),
    totalDebit: round2(lines.reduce((x, l) => x + l.balance_debit, 0)),
    totalCredit: round2(lines.reduce((x, l) => x + l.balance_credit, 0)),
  };
}

export async function profitAndLoss(s: Scope, from: string, to: string) {
  const params: any[] = [s.tenantId, from, to];
  const ent = entClause(s, params);
  const rows = await many<any>(
    { query },
    `SELECT a.code, a.name, a.type, a.subtype, COALESCE(SUM(l.credit - l.debit),0) AS net
       FROM accounts a
       JOIN journal_lines l ON l.account_id=a.id
       JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.entry_date BETWEEN $2::date AND $3::date ${ent}
      WHERE a.tenant_id=$1 AND a.type IN ('revenue','expense')
      GROUP BY a.id ORDER BY a.code`,
    params,
  );
  const revenue = rows.filter((r) => r.type === 'revenue').map((r) => ({ ...r, amount: round2(r.net) }));
  const cogs = rows.filter((r) => r.type === 'expense' && r.subtype === 'cogs').map((r) => ({ ...r, amount: round2(-r.net) }));
  const opex = rows.filter((r) => r.type === 'expense' && r.subtype !== 'cogs').map((r) => ({ ...r, amount: round2(-r.net) }));
  const totalRevenue = round2(revenue.reduce((x, r) => x + r.amount, 0));
  const totalCogs = round2(cogs.reduce((x, r) => x + r.amount, 0));
  const grossProfit = round2(totalRevenue - totalCogs);
  const totalOpex = round2(opex.reduce((x, r) => x + r.amount, 0));
  return { from, to, revenue, cogs, opex, totalRevenue, totalCogs, grossProfit, grossMarginPct: totalRevenue ? round2((grossProfit / totalRevenue) * 100) : 0, totalOpex, netProfit: round2(grossProfit - totalOpex) };
}

export async function balanceSheet(s: Scope, asOf: string) {
  const tb = await trialBalance(s, asOf);
  const bal = (types: string[], sign: 1 | -1) =>
    tb.lines.filter((l) => types.includes(l.type)).map((l) => ({ code: l.code, name: l.name, amount: round2(sign * (l.debit - l.credit)) })).filter((l) => l.amount !== 0);
  const assets = bal(['asset'], 1);
  const liabilities = bal(['liability'], -1);
  const equity = bal(['equity'], -1);
  const earnings = round2(tb.lines.filter((l) => l.type === 'revenue' || l.type === 'expense').reduce((x, l) => x + (l.credit - l.debit), 0));
  const totalAssets = round2(assets.reduce((x, l) => x + l.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((x, l) => x + l.amount, 0));
  const totalEquity = round2(equity.reduce((x, l) => x + l.amount, 0) + earnings);
  return { asOf, assets, liabilities, equity, currentEarnings: earnings, totalAssets, totalLiabilities, totalEquity, balanced: round2(totalAssets - totalLiabilities - totalEquity) === 0 };
}

const SOURCE_LABEL: Record<string, string> = {
  payment: 'Customer receipts / supplier payments', invoice: 'Invoices', bill: 'Bills', payroll: 'Payroll', manual: 'Manual journals', bank: 'Bank entries',
};

/** Direct-method cash flow: movements on bank/cash accounts grouped by source. */
export async function cashFlow(s: Scope, from: string, to: string) {
  const params: any[] = [s.tenantId, from, to];
  const ent = entClause(s, params);
  const rows = await many<any>(
    { query },
    `SELECT e.source, COALESCE(SUM(l.debit),0) AS inflow, COALESCE(SUM(l.credit),0) AS outflow
       FROM journal_lines l
       JOIN accounts a ON a.id=l.account_id AND (a.is_bank OR a.subtype='cash')
       JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.entry_date BETWEEN $2::date AND $3::date ${ent}
      WHERE l.tenant_id=$1 GROUP BY e.source ORDER BY e.source`,
    params,
  );
  const openParams: any[] = [s.tenantId, from];
  const openEnt = entClause(s, openParams);
  const opening = await one<any>(
    { query },
    `SELECT COALESCE(SUM(l.debit - l.credit),0) AS bal FROM journal_lines l
       JOIN accounts a ON a.id=l.account_id AND (a.is_bank OR a.subtype='cash')
       JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted' AND e.entry_date < $2::date ${openEnt}
      WHERE l.tenant_id=$1`,
    openParams,
  );
  const lines = rows.map((r) => ({ source: r.source, label: SOURCE_LABEL[r.source] || r.source, inflow: round2(r.inflow), outflow: round2(r.outflow), net: round2(r.inflow - r.outflow) }));
  const net = round2(lines.reduce((x, l) => x + l.net, 0));
  const openingBalance = round2(opening?.bal || 0);
  return { from, to, openingBalance, lines, netChange: net, closingBalance: round2(openingBalance + net) };
}

export async function generalLedger(s: Scope, accountId: string | null, from: string, to: string, limit = 500) {
  const params: any[] = [s.tenantId, from, to];
  const ent = entClause(s, params);
  let acct = '';
  if (accountId) {
    params.push(accountId);
    acct = ` AND l.account_id = $${params.length}`;
  }
  return many<any>(
    { query },
    `SELECT e.entry_date, e.number, e.memo, e.source, a.code, a.name AS account, l.debit, l.credit, l.memo AS line_memo
       FROM journal_lines l
       JOIN journal_entries e ON e.id=l.entry_id AND e.status='posted'
       JOIN accounts a ON a.id=l.account_id
      WHERE l.tenant_id=$1 AND e.entry_date BETWEEN $2::date AND $3::date ${ent}${acct}
      ORDER BY e.entry_date, e.number, a.code LIMIT ${Math.min(limit, 2000)}`,
    params,
  );
}
