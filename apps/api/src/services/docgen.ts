import { createHash } from 'node:crypto';
import { GENERATED_DOC_LABEL, chargeableKg, generatedSetFor, type GeneratedDocType } from '@digitalburj/shared';
import { Db, many, nextRef, one } from '../db';
import { notFound } from '../lib/errors';
import { publish } from './events';

/** HTML-escape everything that reaches a generated document (customer-supplied text included). */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] as string);

const TBA = 'TO BE ADVISED';
const or = (v: unknown, fallback = TBA) => (v === null || v === undefined || v === '' ? fallback : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmt = (n: number | null, dp = 2) => (n === null || Number.isNaN(n) ? '—' : n.toLocaleString('en-AE', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const day = (v: unknown) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : '—');

const NUMBERING: Record<GeneratedDocType, { key: string; prefix: string }> = {
  BL: { key: 'doc_hbl', prefix: 'HBL-' },
  AWB: { key: 'doc_hawb', prefix: 'HAWB-' },
  CMR: { key: 'doc_cmr', prefix: 'CMR-' },
  PACKING_LIST: { key: 'doc_pl', prefix: 'PL-' },
  COMMERCIAL_INVOICE: { key: 'doc_ci', prefix: 'CI-' },
};

export interface DocContext {
  tenant: { name: string; trn: string | null; trade_license: string | null };
  shipment: Record<string, any>;
  shipper: { name: string; address?: string | null; trn?: string | null } | null;
  consignee: { name: string; address?: string | null; trn?: string | null } | null;
  generatedAt: string;
}

/** Missing booking data does not block generation; it produces a clearly marked DRAFT and reports what to fill in. */
export function warningsFor(type: GeneratedDocType, c: DocContext): string[] {
  const s = c.shipment;
  const w: string[] = [];
  if (!c.shipper) w.push('Shipper (customer) not set');
  if (!c.consignee) w.push('Consignee not set');
  if (!s.cargo_description) w.push('Cargo description missing');
  if (type === 'BL') {
    if (!s.vessel) w.push('Vessel not set');
    if (!s.voyage) w.push('Voyage not set');
    if (!s.container_no && s.mode === 'sea_fcl') w.push('Container number not set');
  }
  if (type === 'AWB') {
    if (!s.voyage) w.push('Flight number not set');
    if (!s.awb_number) w.push('Master AWB reference not set');
  }
  if (type === 'CMR' && !s.destination) w.push('Place of delivery not set');
  if (type === 'COMMERCIAL_INVOICE' && !num(s.cargo_value)) w.push('Cargo value not declared');
  if (type !== 'COMMERCIAL_INVOICE' && !num(s.weight_kg)) w.push('Gross weight missing');
  return w;
}

const STYLE = `body{font:12.5px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#1c2b2b;max-width:860px;margin:22px auto;padding:0 20px}
h1{font-size:20px;margin:0;color:#0A2A2B}h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#5b6b6b;margin:18px 0 6px}
.row{display:flex;justify-content:space-between;gap:24px}.box{border:1px solid #cfd8d8;border-radius:6px;padding:10px 12px;flex:1;min-width:0}
.k{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#6b7b7b}.v{font-weight:600}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #cfd8d8;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f2f5f5;font-size:10.5px;text-transform:uppercase}td.n,th.n{text-align:right}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.draft{background:#fff4e5;border:1px solid #f0c27a;color:#7a4a00;padding:8px 12px;border-radius:6px;margin:12px 0}
.foot{margin-top:22px;font-size:10.5px;color:#6b7b7b;border-top:1px solid #cfd8d8;padding-top:8px}@media print{button{display:none}}`;

const party = (label: string, p: DocContext['shipper']) =>
  `<div class="box"><div class="k">${label}</div><div class="v">${esc(p?.name ?? TBA)}</div>${p?.address ? `<div>${esc(p.address)}</div>` : ''}${p?.trn ? `<div class="k">TRN ${esc(p.trn)}</div>` : ''}</div>`;
const kv = (k: string, v: unknown) => `<div class="box"><div class="k">${esc(k)}</div><div class="v">${esc(or(v))}</div></div>`;

function cargoRow(s: Record<string, any>) {
  const cbm = num(s.volume_cbm);
  return `<tr><td>${esc(or(s.container_no, s.mode === 'air' ? '—' : 'As per booking'))}${s.container_type ? `<br><span class="k">${esc(s.container_type)}</span>` : ''}</td>
<td>${esc(or(s.cargo_description))}${s.hs_code ? `<br><span class="k">HS ${esc(s.hs_code)}</span>` : ''}</td>
<td class="n">${esc(s.pieces ?? '—')}</td><td class="n">${fmt(num(s.weight_kg))}</td><td class="n">${fmt(cbm, 3)}</td></tr>`;
}

const CARGO_HEAD = `<thead><tr><th>Container / marks</th><th>Description of goods</th><th class="n">Packages</th><th class="n">Gross weight (kg)</th><th class="n">Volume (CBM)</th></tr></thead>`;

export function renderDocument(type: GeneratedDocType, docNo: string, version: number, c: DocContext, warnings: string[], hash: string): string {
  const s = c.shipment;
  const title = GENERATED_DOC_LABEL[type].toUpperCase();
  let body = '';

  if (type === 'BL') {
    body = `<div class="row">${party('Shipper', c.shipper)}${party('Consignee', c.consignee)}${party('Notify party', c.consignee)}</div>
<h2>Carriage</h2><div class="grid">${kv('Carrier', s.carrier)}${kv('Vessel / voyage', [s.vessel, s.voyage].filter(Boolean).join(' / ') || null)}${kv('Master B/L no.', s.bl_number)}
${kv('Port of loading', s.pol || s.origin)}${kv('Port of discharge', s.pod || s.destination)}${kv('Place of delivery', s.destination)}${kv('ETD', day(s.etd))}${kv('ETA', day(s.eta))}${kv('Freight terms', s.incoterm ? `Per ${s.incoterm}` : null)}</div>
<h2>Particulars furnished by the shipper</h2><table>${CARGO_HEAD}<tbody>${cargoRow(s)}</tbody></table>
<p class="k" style="margin-top:10px">Received by the carrier the goods described above in apparent good order and condition, unless otherwise noted, to be carried to the port of discharge and delivered to the consignee or its order against surrender of an original bill of lading. This document is a draft prepared from booking data and is issued subject to the carrier's own terms.</p>`;
  } else if (type === 'AWB') {
    const ch = chargeableKg(num(s.weight_kg) ?? 0, num(s.volume_cbm) ?? 0);
    body = `<div class="row">${party('Shipper', c.shipper)}${party('Consignee', c.consignee)}</div>
<h2>Routing</h2><div class="grid">${kv('Airline / carrier', s.carrier)}${kv('Flight', s.voyage)}${kv('Master AWB', s.awb_number)}
${kv('Airport of departure', s.pol || s.origin)}${kv('Airport of destination', s.pod || s.destination)}${kv('Flight date (ETD)', day(s.etd))}</div>
<h2>Consignment</h2><table><thead><tr><th class="n">Pieces</th><th class="n">Gross weight (kg)</th><th class="n">Chargeable weight (kg)</th><th>Nature and quantity of goods</th></tr></thead>
<tbody><tr><td class="n">${esc(s.pieces ?? '—')}</td><td class="n">${fmt(num(s.weight_kg))}</td><td class="n">${fmt(ch.kg)} <span class="k">(${ch.basis})</span></td><td>${esc(or(s.cargo_description))}${s.hs_code ? `<br><span class="k">HS ${esc(s.hs_code)}</span>` : ''}</td></tr></tbody></table>
<p class="k" style="margin-top:10px">Draft house air waybill prepared from booking data. Shipper certifies that the particulars are correct; issue under the forwarder's own conditions of contract.</p>`;
  } else if (type === 'CMR') {
    body = `<div class="row">${party('Sender', c.shipper)}${party('Consignee', c.consignee)}</div>
<h2>Carriage</h2><div class="grid">${kv('Carrier', s.carrier || c.tenant.name)}${kv('Place of taking over', s.origin)}${kv('Place of delivery', s.destination)}${kv('Date', day(s.etd))}${kv('Incoterm', s.incoterm)}${kv('Vehicle / driver', 'As per dispatch')}</div>
<h2>Goods</h2><table>${CARGO_HEAD}<tbody>${cargoRow(s)}</tbody></table>
<p class="k" style="margin-top:10px">Consignment note prepared from booking data for carriage by road. Signatures of sender, carrier and consignee are applied on the original at loading and delivery.</p>`;
  } else if (type === 'PACKING_LIST') {
    body = `<div class="row">${party('Shipper', c.shipper)}${party('Consignee', c.consignee)}</div>
<h2>Shipment</h2><div class="grid">${kv('Job reference', s.number)}${kv('From', s.origin)}${kv('To', s.destination)}</div>
<h2>Packages</h2><table>${CARGO_HEAD}<tbody>${cargoRow(s)}</tbody></table>
<p class="k" style="margin-top:10px">Net weight and package dimensions are not held on the job record; complete them from the supplier's packing list before use.</p>`;
  } else {
    const value = num(s.cargo_value);
    const qty = num(s.pieces) ?? 1;
    body = `<div class="row">${party('Seller / exporter', c.shipper)}${party('Buyer / consignee', c.consignee)}</div>
<h2>Terms</h2><div class="grid">${kv('Incoterm', s.incoterm)}${kv('Currency', s.currency || 'AED')}${kv('Job reference', s.number)}</div>
<h2>Goods</h2><table><thead><tr><th>Description</th><th>HS code</th><th class="n">Qty</th><th class="n">Unit value</th><th class="n">Total</th></tr></thead>
<tbody><tr><td>${esc(or(s.cargo_description))}</td><td>${esc(or(s.hs_code, '—'))}</td><td class="n">${fmt(qty, 0)}</td><td class="n">${value !== null ? fmt(value / qty) : '—'}</td><td class="n">${fmt(value)}</td></tr></tbody></table>
<p class="v" style="text-align:right">Total ${esc(s.currency || 'AED')} ${fmt(value)}</p>
<p class="k">Declared customs value. This commercial invoice is prepared from booking data; it is not a VAT tax invoice for freight services.</p>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(docNo)} v${version}</title><style>${STYLE}</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 14px">Print / Save PDF</button>
<div class="row"><div><h1>${esc(c.tenant.name)}</h1><div class="k">TRN ${esc(c.tenant.trn || '—')}${c.tenant.trade_license ? ` · Licence ${esc(c.tenant.trade_license)}` : ''}</div></div>
<div style="text-align:right"><h1 style="color:#E8472B">${esc(title)}</h1><div><b>${esc(docNo)}</b> · version ${version}</div><div class="k">Job ${esc(s.number)} · ${esc(day(c.generatedAt))}</div></div></div>
${warnings.length ? `<div class="draft"><b>DRAFT — incomplete booking data.</b> ${warnings.map(esc).join(' · ')}</div>` : ''}
${body}
<div class="foot">Generated by DigitalBurj Logistics OS on ${esc(c.generatedAt)}. Integrity: sha256:${hash.slice(0, 32)}…</div></body></html>`;
}

export interface GeneratedDoc { id: string; type: GeneratedDocType; doc_no: string; version: number; name: string; warnings: string[]; generated_at: string }

/**
 * Generate (or regenerate → next version) the document set for a shipment. Idempotent per call in the sense that the
 * document number is stable across versions; each call adds one row per type.
 */
export async function generateShipmentDocuments(db: Db, tenantId: string, userId: string | null, shipmentId: string, opts: { types?: GeneratedDocType[]; reason?: string } = {}): Promise<GeneratedDoc[]> {
  const s = await one<any>(db, 'SELECT * FROM shipments WHERE id=$1 AND tenant_id=$2', [shipmentId, tenantId]);
  if (!s) throw notFound('Shipment not found');
  const tenant = await one<any>(db, 'SELECT name, trn, trade_license FROM tenants WHERE id=$1', [tenantId]);
  const load = (id: string | null) => (id ? one<any>(db, 'SELECT name, address, city, trn FROM customers WHERE id=$1 AND tenant_id=$2', [id, tenantId]) : Promise.resolve(null));
  const [shipperRow, consigneeRow] = await Promise.all([load(s.customer_id), load(s.consignee_id || s.customer_id)]);
  const asParty = (r: any) => (r ? { name: r.name, address: [r.address, r.city].filter(Boolean).join(', ') || null, trn: r.trn } : null);
  const generatedAt = new Date().toISOString();
  const ctx: DocContext = { tenant, shipment: s, shipper: asParty(shipperRow), consignee: asParty(consigneeRow), generatedAt };

  const wanted = (opts.types?.length ? opts.types : generatedSetFor(s.mode)).filter((t) => generatedSetFor(s.mode).includes(t));
  const out: GeneratedDoc[] = [];
  for (const type of wanted) {
    const existing = await one<any>(db, `SELECT doc_no, max(version) AS v FROM documents WHERE shipment_id=$1 AND tenant_id=$2 AND origin='generated' AND type=$3 GROUP BY doc_no ORDER BY max(version) DESC LIMIT 1`, [shipmentId, tenantId, type]);
    const n = NUMBERING[type];
    const docNo = existing?.doc_no ?? (await nextRef(db, tenantId, n.key, n.prefix, 5, 1000));
    const version = existing ? Number(existing.v) + 1 : 1;
    const warnings = warningsFor(type, ctx);
    const data = { type, docNo, version, generatedAt, reason: opts.reason ?? null, warnings, shipper: ctx.shipper, consignee: ctx.consignee, shipment: { number: s.number, mode: s.mode, origin: s.origin, destination: s.destination, carrier: s.carrier, vessel: s.vessel, voyage: s.voyage, container_no: s.container_no, weight_kg: s.weight_kg, volume_cbm: s.volume_cbm, cargo_value: s.cargo_value } };
    const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const html = renderDocument(type, docNo, version, ctx, warnings, hash);
    const name = `${docNo} v${version} — ${GENERATED_DOC_LABEL[type]} (${s.number}).html`;
    const row = await one<any>(db,
      `INSERT INTO documents (tenant_id, shipment_id, customer_id, type, name, mime, size, origin, doc_no, version, generated_at, body_html, generated_data, is_public, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,'text/html',$6,'generated',$7,$8,now(),$9,$10,false,$11) RETURNING id, generated_at`,
      [tenantId, shipmentId, s.customer_id, type, name, Buffer.byteLength(html), docNo, version, html, JSON.stringify({ ...data, sha256: hash }), userId]);
    out.push({ id: row.id, type, doc_no: docNo, version, name, warnings, generated_at: row.generated_at });
  }
  if (out.length) publish({ tenantId, type: 'documents.generated', entityType: 'shipment', entityId: shipmentId, payload: { number: s.number, count: out.length, types: out.map((d) => d.type), reason: opts.reason ?? null }, userId: userId ?? undefined });
  return out;
}

export async function latestGenerated(db: Db, tenantId: string, shipmentId: string) {
  return many<any>(db, `SELECT DISTINCT ON (type) id, type, doc_no, version, name, generated_at FROM documents WHERE tenant_id=$1 AND shipment_id=$2 AND origin='generated' ORDER BY type, version DESC`, [tenantId, shipmentId]);
}
