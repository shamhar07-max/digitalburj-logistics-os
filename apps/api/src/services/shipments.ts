import {
  MILESTONE_TEMPLATES, SHIPMENT_TRANSITIONS, STATUS_MILESTONE, canTransition, defaultTaxCode, round2,
  type Mode, type ShipmentStatus,
} from '@digitalburj/shared';
import { Db, many, nextRef, one } from '../db';
import { badRequest, notFound } from '../lib/errors';
import { publish } from './events';
import { notifyPermitted } from './notify';
import { assessRisk } from './risk';

export interface NewShipment {
  customer_id?: string | null;
  consignee_id?: string | null;
  quote_id?: string | null;
  mode: Mode;
  origin?: string | null;
  destination?: string | null;
  pol?: string | null;
  pod?: string | null;
  carrier?: string | null;
  incoterm?: string | null;
  cargo_description?: string | null;
  container_type?: string | null;
  containers?: number | null;
  weight_kg?: number | null;
  volume_cbm?: number | null;
  cargo_value?: number | null;
  etd?: string | null;
  eta?: string | null;
  priority?: string;
  ops_owner_id?: string | null;
  entity_id?: string | null;
}

export async function createShipment(db: Db, tenantId: string, userId: string, s: NewShipment) {
  const number = await nextRef(db, tenantId, 'shipment', 'DXB-', 0, 4510);
  const row = (
    await db.query(
      `INSERT INTO shipments (tenant_id, entity_id, number, quote_id, customer_id, consignee_id, mode, origin, destination, pol, pod, carrier, incoterm, cargo_description,
                              container_type, containers, weight_kg, volume_cbm, cargo_value, etd, eta, priority, ops_owner_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
      [
        tenantId, s.entity_id ?? null, number, s.quote_id ?? null, s.customer_id ?? null, s.consignee_id ?? null, s.mode, s.origin ?? null, s.destination ?? null, s.pol ?? null, s.pod ?? null,
        s.carrier ?? null, s.incoterm ?? null, s.cargo_description ?? null, s.container_type ?? null, s.containers ?? 1, s.weight_kg ?? null, s.volume_cbm ?? null, s.cargo_value ?? null,
        s.etd ?? null, s.eta ?? null, s.priority ?? 'normal', s.ops_owner_id ?? null, userId,
      ],
    )
  ).rows[0];
  const base = s.etd ? new Date(s.etd) : new Date();
  const tpl = MILESTONE_TEMPLATES[s.mode] || MILESTONE_TEMPLATES.multimodal;
  let sort = 0;
  for (const m of tpl) {
    const due = new Date(base.getTime() + m.offsetDays * 86_400_000);
    await db.query(`INSERT INTO milestones (tenant_id, shipment_id, code, name, due_at, sort, status, done_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
      tenantId, row.id, m.code, m.name, due.toISOString(), sort++, 'pending', null,
    ]);
  }
  publish({ tenantId, type: 'shipment.created', entityType: 'shipment', entityId: row.id, payload: { number, customer_id: s.customer_id }, userId });
  return row;
}

/** Copy quote lines to shipment revenue/cost charges (keeps shipment P&L consistent with the quote). */
export async function chargesFromQuote(db: Db, tenantId: string, shipmentId: string, quoteId: string) {
  const items = await many<any>(db, 'SELECT * FROM quote_items WHERE quote_id=$1 AND tenant_id=$2 ORDER BY sort', [quoteId, tenantId]);
  for (const it of items) {
    const rev = round2(Number(it.quantity) * Number(it.unit_price));
    await db.query(
      `INSERT INTO charges (tenant_id, shipment_id, kind, charge_type, description, quantity, unit_amount, amount_aed, tax_code) VALUES ($1,$2,'revenue',$3,$4,$5,$6,$7,$8)`,
      [tenantId, shipmentId, it.charge_type, it.description, it.quantity, it.unit_price, rev, it.tax_code],
    );
    const cost = round2(Number(it.quantity) * Number(it.unit_cost));
    if (cost > 0) {
      await db.query(
        `INSERT INTO charges (tenant_id, shipment_id, kind, charge_type, description, supplier_id, quantity, unit_amount, amount_aed, tax_code) VALUES ($1,$2,'cost',$3,$4,$5,$6,$7,$8,$9)`,
        [tenantId, shipmentId, it.charge_type, it.description, it.supplier_id, it.quantity, it.unit_cost, cost, defaultTaxCode(it.charge_type)],
      );
    }
  }
}

export async function changeShipmentStatus(db: Db, tenantId: string, userId: string, id: string, to: string, note?: string) {
  const s = await one<any>(db, 'SELECT * FROM shipments WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, id]);
  if (!s) throw notFound('Shipment not found');
  if (s.status === to) return s;
  if (!canTransition(SHIPMENT_TRANSITIONS as any, s.status, to)) {
    throw badRequest(`Cannot move shipment from "${s.status}" to "${to}". Allowed: ${(SHIPMENT_TRANSITIONS[s.status as ShipmentStatus] || []).join(', ') || 'none'}`);
  }
  if (to === 'customs') {
    const decl = await one(db, `SELECT 1 FROM customs_declarations WHERE tenant_id=$1 AND shipment_id=$2 LIMIT 1`, [tenantId, id]);
    // Not blocking, but ensure a declaration shell exists so customs team sees the job
    if (!decl) {
      const num = await nextRef(db, tenantId, 'customs', 'CD-', 5, 0);
      await db.query(`INSERT INTO customs_declarations (tenant_id, shipment_id, number, type, description, cif_value, duty_amount) VALUES ($1,$2,$3,'import',$4,$5,$6)`, [
        tenantId, id, num, s.cargo_description, s.cargo_value || 0, round2((s.cargo_value || 0) * 0.05),
      ]);
    }
  }
  const sets: string[] = ['status=$3'];
  const params: any[] = [tenantId, id, to];
  if (to === 'in_transit') sets.push('atd=COALESCE(atd, current_date)');
  if (to === 'arrived') sets.push('ata=COALESCE(ata, current_date)');
  if (to === 'delivered') sets.push('delivered_at=now()');
  const row = (await db.query(`UPDATE shipments SET ${sets.join(', ')} WHERE tenant_id=$1 AND id=$2 RETURNING *`, params)).rows[0];

  const codes = STATUS_MILESTONE[to as ShipmentStatus];
  if (codes?.length) {
    await db.query(`UPDATE milestones SET status='done', done_at=COALESCE(done_at, now()) WHERE shipment_id=$1 AND code = ANY($2) AND status <> 'done'`, [id, codes]);
  }
  if (note) {
    await db.query(`INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, changes) VALUES ($1,$2,'status_note','shipment',$3,$4)`, [tenantId, userId, id, JSON.stringify({ from: s.status, to, note })]);
  }
  publish({ tenantId, type: 'shipment.status_changed', entityType: 'shipment', entityId: id, payload: { number: row.number, from: s.status, to, customer_id: row.customer_id }, userId });
  if (to === 'delivered') {
    await notifyPermitted(tenantId, 'invoices', 'c', { title: `${row.number} delivered — ready to invoice`, body: 'Delivery confirmed. Unbilled revenue is ready for invoicing.', level: 'success', link: `/shipments/${id}` }, db);
  }
  return row;
}

/** Recompute risk for every open shipment of a tenant (or one shipment). Returns number changed. */
export async function refreshRisk(db: Db, tenantId: string, shipmentId?: string) {
  const rows = await many<any>(
    db,
    `SELECT s.id, s.number, s.status, s.eta, s.free_days_end, s.risk_level, s.risk_reason, s.delivered_at,
            (SELECT c.status FROM customs_declarations c WHERE c.shipment_id=s.id ORDER BY c.created_at DESC LIMIT 1) AS customs_status,
            (SELECT c.hold_reason FROM customs_declarations c WHERE c.shipment_id=s.id ORDER BY c.created_at DESC LIMIT 1) AS customs_hold_reason,
            (SELECT cu.status = 'hold' FROM customers cu WHERE cu.id=s.customer_id) AS credit_hold,
            NOT EXISTS (SELECT 1 FROM pods p WHERE p.shipment_id=s.id) AS no_pod
       FROM shipments s
      WHERE s.tenant_id=$1 AND s.status NOT IN ('closed','cancelled','invoiced') ${shipmentId ? 'AND s.id=$2' : ''}`,
    shipmentId ? [tenantId, shipmentId] : [tenantId],
  );
  let changed = 0;
  for (const r of rows) {
    const podOverdue = r.status === 'delivered' && r.no_pod && r.delivered_at ? Math.floor((Date.now() - new Date(r.delivered_at).getTime()) / 86_400_000) : 0;
    const res = assessRisk({ ...r, pod_overdue_days: podOverdue });
    if (res.level !== r.risk_level || (res.reason || null) !== (r.risk_reason || null)) {
      await db.query('UPDATE shipments SET risk_level=$2, risk_reason=$3 WHERE id=$1', [r.id, res.level, res.reason]);
      changed++;
      if (res.level === 'high' && r.risk_level !== 'high') {
        publish({ tenantId, type: 'shipment.at_risk', entityType: 'shipment', entityId: r.id, payload: { number: r.number, reason: res.reason } });
        await notifyPermitted(tenantId, 'shipments', 'u', { title: `${r.number} at risk`, body: res.reason || '', level: 'warning', link: `/shipments/${r.id}` }, db);
      }
    }
  }
  return changed;
}
