import { round2 } from '@digitalburj/shared';
import { many, one, query } from '../db';
import { getSettings } from './settings';

export type Severity = 'high' | 'medium' | 'low';
export interface Finding {
  agent: string;
  severity: Severity;
  title: string;
  detail: string;
  link?: string;
  action?: { kind: 'hold_customer' | 'chase_pod' | 'open'; id?: string; label: string };
}

export const AGENTS = [
  { key: 'customs', name: 'Customs Sentinel', desc: 'Watches holds, rejected declarations and missing customs documents.' },
  { key: 'credit', name: 'Credit Guardian', desc: 'Flags customers over their credit limit or with long-overdue invoices.' },
  { key: 'demurrage', name: 'Demurrage Watch', desc: 'Tracks container free-time and ETA slippage before charges accrue.' },
  { key: 'pod', name: 'POD Chaser', desc: 'Finds delivered jobs with no proof of delivery and blocks billing risk.' },
  { key: 'margin', name: 'Margin Watch', desc: 'Detects negative or below-floor margin on quotes and jobs.' },
  { key: 'cash', name: 'Cash Forecaster', desc: 'Projects the next 30 days of receipts and payments.' },
  { key: 'pipeline', name: 'Deal Coach', desc: 'Surfaces stale high-probability deals and expiring quotes.' },
  { key: 'compliance', name: 'Compliance Keeper', desc: 'Visa, licence, Mulkiya and insurance expiries before they become fines.' },
] as const;

/** Rule-based agents over live tenant data. Deterministic, explainable, no LLM required. */
export async function runAgents(tenantId: string): Promise<Finding[]> {
  const q = { query };
  const [customs, credit, dem, pods, unbilled, negMargin, lowQuotes, staleDeals, expQuotes, expiries, ar, ap] = await Promise.all([
    many<any>(q, `SELECT c.number, c.status, c.hold_reason, c.shipment_id, s.number AS shipment_number FROM customs_declarations c LEFT JOIN shipments s ON s.id=c.shipment_id WHERE c.tenant_id=$1 AND c.status IN ('hold','rejected')`, [tenantId]),
    many<any>(q, `SELECT cu.id, cu.name, cu.credit_limit, cu.status, COALESCE(SUM(i.total-i.paid),0) AS outstanding,
                         COALESCE(MAX(current_date - i.due_date) FILTER (WHERE i.due_date < current_date),0)::int AS max_days
                    FROM customers cu JOIN invoices i ON i.customer_id=cu.id AND i.status IN ('sent','partial','overdue') AND i.kind='tax_invoice'
                   WHERE cu.tenant_id=$1 GROUP BY cu.id HAVING (cu.credit_limit > 0 AND SUM(i.total-i.paid) > cu.credit_limit) OR MAX(current_date - i.due_date) > 30`, [tenantId]),
    many<any>(q, `SELECT id, number, container_no, free_days_end, eta, status FROM shipments WHERE tenant_id=$1 AND status NOT IN ('delivered','invoiced','closed','cancelled') AND free_days_end IS NOT NULL AND free_days_end < now() + interval '72 hours'`, [tenantId]),
    many<any>(q, `SELECT s.id, s.number, (current_date - s.delivered_at::date) AS days FROM shipments s WHERE s.tenant_id=$1 AND s.status='delivered' AND s.delivered_at < now() - interval '2 days' AND NOT EXISTS (SELECT 1 FROM pods p WHERE p.shipment_id=s.id)`, [tenantId]),
    many<any>(q, `SELECT s.id, s.number, SUM(ch.amount_aed) AS amount FROM shipments s JOIN charges ch ON ch.shipment_id=s.id AND ch.kind='revenue' AND ch.invoice_id IS NULL WHERE s.tenant_id=$1 AND s.status='delivered' AND s.delivered_at < now() - interval '1 day' GROUP BY s.id`, [tenantId]),
    many<any>(q, `SELECT s.id, s.number, SUM(CASE WHEN ch.kind='revenue' THEN ch.amount_aed ELSE -ch.amount_aed END) AS margin FROM shipments s JOIN charges ch ON ch.shipment_id=s.id WHERE s.tenant_id=$1 AND s.status NOT IN ('cancelled') GROUP BY s.id HAVING SUM(CASE WHEN ch.kind='revenue' THEN ch.amount_aed ELSE -ch.amount_aed END) < 0`, [tenantId]),
    many<any>(q, `SELECT id, number, margin_pct FROM quotes WHERE tenant_id=$1 AND status IN ('draft','pending_approval','sent') AND margin_pct < 5`, [tenantId]),
    many<any>(q, `SELECT id, title, value, probability, (current_date - updated_at::date) AS idle FROM deals WHERE tenant_id=$1 AND stage IN ('qualified','quoted','negotiation') AND probability >= 50 AND updated_at < now() - interval '7 days'`, [tenantId]),
    many<any>(q, `SELECT id, number, valid_until FROM quotes WHERE tenant_id=$1 AND status='sent' AND valid_until BETWEEN current_date AND current_date + 3`, [tenantId]),
    many<any>(q, `SELECT * FROM (
        SELECT 'Employee' AS kind, name, 'visa' AS doc, visa_expiry AS d FROM employees WHERE tenant_id=$1 AND status<>'terminated'
        UNION ALL SELECT 'Driver', name, 'licence', license_expiry FROM drivers WHERE tenant_id=$1 AND status<>'inactive'
        UNION ALL SELECT 'Vehicle', plate, 'Mulkiya', mulkiya_expiry FROM vehicles WHERE tenant_id=$1 AND status<>'retired'
        UNION ALL SELECT 'Vehicle', plate, 'insurance', insurance_expiry FROM vehicles WHERE tenant_id=$1 AND status<>'retired') x
       WHERE d IS NOT NULL AND d <= current_date + 30 ORDER BY d LIMIT 20`, [tenantId]),
    one<any>(q, `SELECT COALESCE(SUM(total-paid) FILTER (WHERE due_date <= current_date + 30),0) AS due30 FROM invoices WHERE tenant_id=$1 AND kind='tax_invoice' AND status IN ('sent','partial','overdue')`, [tenantId]),
    one<any>(q, `SELECT COALESCE(SUM(total-paid) FILTER (WHERE due_date <= current_date + 30),0) AS due30 FROM bills WHERE tenant_id=$1 AND status IN ('open','partial')`, [tenantId]),
  ]);
  const settings = await getSettings(q, tenantId);
  const out: Finding[] = [];
  for (const c of customs) out.push({ agent: 'customs', severity: 'high', title: `Customs ${c.status} on ${c.shipment_number || c.number}`, detail: c.hold_reason || 'Declaration needs attention', link: '/customs' });
  for (const c of credit) {
    const over = c.credit_limit > 0 && c.outstanding > c.credit_limit;
    out.push({ agent: 'credit', severity: c.max_days > 45 || over ? 'high' : 'medium', title: `${c.name} — AED ${Math.round(c.outstanding).toLocaleString()} outstanding`, detail: `${over ? `Over credit limit (AED ${Number(c.credit_limit).toLocaleString()}). ` : ''}${c.max_days}d oldest overdue`, link: '/invoices', action: c.status !== 'hold' ? { kind: 'hold_customer', id: c.id, label: 'Place on hold' } : undefined });
  }
  for (const d of dem) {
    const hrs = Math.round((new Date(d.free_days_end).getTime() - Date.now()) / 3_600_000);
    out.push({ agent: 'demurrage', severity: hrs <= 24 ? 'high' : 'medium', title: `${d.container_no || d.number}: ${hrs <= 0 ? 'free time expired' : `${hrs}h of free time left`}`, detail: `Shipment ${d.number} · ${d.status}`, link: `/shipments/${d.id}` });
  }
  for (const p of pods) out.push({ agent: 'pod', severity: p.days >= 4 ? 'high' : 'medium', title: `POD missing for ${p.number}`, detail: `${p.days} days since delivery — invoice release at risk`, link: `/shipments/${p.id}`, action: { kind: 'chase_pod', id: p.id, label: 'Chase driver' } });
  for (const u of unbilled) out.push({ agent: 'margin', severity: 'medium', title: `${u.number} delivered but unbilled`, detail: `AED ${Math.round(u.amount).toLocaleString()} ready to invoice`, link: '/invoices' });
  for (const n of negMargin) out.push({ agent: 'margin', severity: 'high', title: `${n.number} is loss-making`, detail: `Margin AED ${Math.round(n.margin).toLocaleString()} — review costs and pass-through charges`, link: `/shipments/${n.id}` });
  for (const qt of lowQuotes) out.push({ agent: 'margin', severity: qt.margin_pct < 0 ? 'high' : 'medium', title: `Quote ${qt.number} margin ${qt.margin_pct}%`, detail: `Below the ${settings.min_margin_pct}% floor`, link: '/quotes' });
  for (const d of staleDeals) out.push({ agent: 'pipeline', severity: 'medium', title: `${d.title} idle ${d.idle}d`, detail: `${d.probability}% probability · AED ${Math.round(d.value).toLocaleString()}`, link: '/pipeline' });
  for (const e of expQuotes) out.push({ agent: 'pipeline', severity: 'low', title: `Quote ${e.number} expires ${e.valid_until}`, detail: 'Follow up before the offer lapses', link: '/quotes' });
  for (const e of expiries) {
    const days = Math.floor((Date.parse(e.d) - Date.now()) / 86_400_000);
    out.push({ agent: 'compliance', severity: days < 0 ? 'high' : days <= 14 ? 'medium' : 'low', title: `${e.kind} ${e.name}: ${e.doc} ${days < 0 ? 'expired' : `expires in ${days}d`}`, detail: String(e.d), link: e.kind === 'Employee' ? '/hrms' : '/drivers' });
  }
  const net = round2(Number(ar!.due30) - Number(ap!.due30));
  out.push({ agent: 'cash', severity: net < 0 ? 'medium' : 'low', title: `30-day cash outlook: ${net >= 0 ? '+' : '−'}AED ${Math.abs(Math.round(net)).toLocaleString()}`, detail: `Receipts due AED ${Math.round(ar!.due30).toLocaleString()} vs payments due AED ${Math.round(ap!.due30).toLocaleString()}`, link: '/accounting' });
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
