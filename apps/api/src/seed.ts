/**
 * Demo data seed. Drives the REAL HTTP API in-process (so every business rule — RBAC, approvals, GL posting,
 * VAT, state machines — is exercised exactly as in production). Refuses to run in production unless SEED_DEMO=true.
 * Usage: npm run seed            (idempotent: skips if the demo tenant exists)
 *        npm run seed -- --reset (DEV ONLY: drops and recreates the schema first)
 */
import http from 'node:http';
import bcrypt from 'bcryptjs';
import { validIbanAE } from '@digitalburj/shared';
import { config } from './config';
import { logger } from './logger';
import { migrate } from './migrate';
import { one, pool, query } from './db';
import { createApp } from './app';
import { provisionTenant } from './services/tenant';
import { isValidContainerNo } from './services/docintel';

export const DEMO_PASSWORD = 'Demo@12345!';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function containerNo(prefix: string, serial: number) {
  const s = prefix + String(serial).padStart(6, '0');
  for (let c = 0; c < 10; c++) if (isValidContainerNo(s + c)) return s + c;
  return s + '0';
}
function aeIban(bank: string, acct: string) {
  // brute-force the two check digits so the IBAN passes mod-97
  for (let n = 2; n < 98; n++) {
    const iban = `AE${String(n).padStart(2, '0')}${bank}${acct}`;
    if (validIbanAE(iban)) return iban;
  }
  throw new Error('iban');
}

type Client = ReturnType<typeof client>;
function client(base: string, token?: string) {
  const call = async (method: string, path: string, body?: any) => {
    const r = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let data: any = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${typeof data === 'string' ? data : JSON.stringify(data?.error || data)}`);
    return data;
  };
  return { get: (p: string) => call('GET', p), post: (p: string, b?: any) => call('POST', p, b ?? {}), patch: (p: string, b: any) => call('PATCH', p, b), put: (p: string, b: any) => call('PUT', p, b), del: (p: string) => call('DELETE', p) };
}

export async function seedDemo(opts: { reset?: boolean; skipMigrate?: boolean } = {}) {
  if (config.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true') throw new Error('Refusing to seed demo data in production (set SEED_DEMO=true to override)');
  if (opts.reset) {
    if (config.NODE_ENV === 'production') throw new Error('--reset is never allowed in production');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  if (!opts.skipMigrate) await migrate();
  if (await one({ query }, "SELECT 1 FROM tenants WHERE slug='al-noor'")) {
    logger.info('demo tenant already exists — skipping seed (use --reset to rebuild)');
    return { skipped: true };
  }

  // ── tenant + users (direct DB: bootstrap) ──
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { tenant, entity, owner } = await provisionTenant({ query } as any, { name: 'Al Noor Logistics LLC', slug: 'al-noor', ownerName: 'Ahmed Al Mansouri', ownerEmail: 'owner@alnoor.ae', ownerPassword: DEMO_PASSWORD, trn: '100420987600003', tradeLicense: 'DED-884219' });
  const ent2 = (await query(`INSERT INTO entities (tenant_id, code, name, branch, trn) VALUES ($1,'JAFZA','Gulf Freight Division','Jebel Ali','100420987600011') RETURNING *`, [tenant.id])).rows[0];
  const ent3 = (await query(`INSERT INTO entities (tenant_id, code, name, branch, trn) VALUES ($1,'AUH','Al Noor Abu Dhabi','Abu Dhabi','100420987600029') RETURNING *`, [tenant.id])).rows[0];
  void ent2; void ent3;
  const mkUser = async (email: string, name: string, role: string, extra: Record<string, any> = {}) =>
    (await query(`INSERT INTO users (tenant_id, email, password_hash, name, role, customer_id, entity_ids, phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [tenant.id, email, hash, name, role, extra.customer_id ?? null, [entity.id], extra.phone ?? null])).rows[0].id as string;
  const uid: Record<string, string> = { owner: owner.id };
  uid.admin = await mkUser('admin@alnoor.ae', 'Khalid Rahman', 'admin');
  uid.sales = await mkUser('sales@alnoor.ae', 'Sara Al Hashimi', 'sales');
  uid.operations = await mkUser('ops@alnoor.ae', 'Omar Farouk', 'operations');
  uid.customs = await mkUser('customs@alnoor.ae', 'Layla Haddad', 'customs');
  uid.transport = await mkUser('dispatch@alnoor.ae', 'Yusuf Karim', 'transport');
  uid.warehouse = await mkUser('warehouse@alnoor.ae', 'Hassan Ali', 'warehouse');
  uid.finance = await mkUser('finance@alnoor.ae', 'Fatima Zahra', 'finance');
  uid.hr = await mkUser('hr@alnoor.ae', 'Noura Al Ketbi', 'hr');
  uid.driver = await mkUser('driver@alnoor.ae', 'Mohammed Iqbal', 'driver', { phone: '0501112233' });

  // ── local HTTP server so everything below goes through the real app ──
  const server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const login = async (email: string) => client(base, (await client(base).post('/auth/login', { email, password: DEMO_PASSWORD })).accessToken);
  try {
    const [owner_, sales, ops, customs, dispatch, wh, fin, hr, driver] = await Promise.all([
      login('owner@alnoor.ae'), login('sales@alnoor.ae'), login('ops@alnoor.ae'), login('customs@alnoor.ae'), login('dispatch@alnoor.ae'),
      login('warehouse@alnoor.ae'), login('finance@alnoor.ae'), login('hr@alnoor.ae'), login('driver@alnoor.ae'),
    ]);

    // ── master data ──
    const C: Record<string, string> = {};
    const custDefs = [
      ['noon', 'Noon.com (Namshi FZ-LLC)', 'shipper', '100312345600003', 'Shanghai → Jebel Ali', 250000, 30, 'ops@noon-demo.ae', '0501234567'],
      ['aramex', 'Aramex Gulf FZ-LLC', 'shipper', '100298765400003', 'Hong Kong → DXB', 300000, 30, 'freight@aramex-demo.ae', '0502345678'],
      ['futtaim', 'Al Futtaim Trading LLC', 'shipper', '100254321000003', 'Nhava Sheva → Jebel Ali', 60000, 30, 'logistics@futtaim-demo.ae', '0503456789'],
      ['emsteel', 'Emirates Industrial Steel LLC', 'consignee', '100277711100003', 'Mumbai → Abu Dhabi', 150000, 45, 'imports@emsteel-demo.ae', '0504567890'],
      ['lulu', 'Gulf Retail Group', 'shipper', '100266655500003', 'Colombo → Jebel Ali', 120000, 30, 'supply@gulfretail-demo.ae', '0505678901'],
      ['danube', 'Danube Building Materials', 'consignee', '100233344400003', 'Istanbul → Jebel Ali', 90000, 30, 'buy@danube-demo.ae', '0506789012'],
    ] as const;
    for (const [k, name, type, trn, lane, limit, days, email, phone] of custDefs) {
      const c = await sales.post('/customers', { name, type, trn, main_lane: lane, credit_limit: limit, credit_days: days, email, phone, city: 'Dubai', country: 'AE', address: 'Dubai, UAE' });
      C[k] = c.id;
      await sales.post('/contacts', { customer_id: c.id, name: `${name.split(' ')[0]} Logistics Desk`, email, phone, whatsapp: phone, role: 'Logistics manager' });
    }
    await query(`UPDATE customers SET owner_id=$2 WHERE tenant_id=$1`, [tenant.id, uid.sales]);
    const portalUser = (await query(`INSERT INTO users (tenant_id, email, password_hash, name, role, customer_id, entity_ids) VALUES ($1,'portal@noon-demo.ae',$2,'Noon Logistics','customer',$3,$4) RETURNING id`, [tenant.id, hash, C.noon, [entity.id]])).rows[0].id;
    void portalUser;

    const S: Record<string, string> = {};
    for (const [k, name, type] of [['msc', 'MSC Mediterranean Shipping', 'carrier'], ['maersk', 'Maersk Line', 'carrier'], ['ek', 'Emirates SkyCargo', 'carrier'], ['dpw', 'DP World Handling', 'agent'], ['truck', 'Rapid Haulage LLC', 'trucker'], ['broker', 'Gulf Customs Brokers', 'customs_broker']] as const) {
      S[k] = (await fin.post('/suppliers', { name, type, payment_days: 30, email: `${k}@supplier-demo.ae`, trn: '10099988870000' + (k.length % 10) })).id;
    }
    const rateDefs = [
      ['msc', 'Shanghai', 'Jebel Ali', 'sea_fcl', '40HC', 'container', 4300, 5200, 20], ['maersk', 'Nhava Sheva', 'Jebel Ali', 'sea_fcl', '40HC', 'container', 2100, 2650, 9],
      ['maersk', 'Rotterdam', 'Jebel Ali', 'sea_fcl', '40HC', 'container', 3100, 3800, 18], ['ek', 'Hong Kong', 'Dubai (DXB)', 'air', 'General', 'kg', 8.2, 10.4, 3],
      ['msc', 'Colombo', 'Jebel Ali', 'sea_lcl', 'LCL', 'cbm', 95, 130, 12], ['truck', 'Jebel Ali', 'Dubai', 'road', 'Trailer', 'trip', 420, 600, 1],
      ['truck', 'Jebel Ali', 'Abu Dhabi', 'road', 'Trailer', 'trip', 650, 880, 1], ['msc', 'Istanbul', 'Jebel Ali', 'sea_fcl', '40HC', 'container', 3400, 4100, 16],
    ] as const;
    const R: string[] = [];
    for (const [sup, o, d, mode, ct, unit, buy, sell, td] of rateDefs) R.push((await owner_.post('/rates', { supplier_id: S[sup], origin: o, destination: d, mode, container_type: ct, unit, buy_rate: buy, sell_rate: sell, transit_days: td, valid_from: day(-30), valid_to: day(60), status: 'active' })).id);

    // ── pipeline ──
    const dealDefs = [
      ['Noon: Q4 peak season FCL programme', 'noon', 'qualified', 185000, 'referral', 'Shanghai → Jebel Ali', 'sea_fcl'], ['Aramex: HKG air consolidation', 'aramex', 'negotiation', 96000, 'website', 'Hong Kong → DXB', 'air'],
      ['Al Futtaim: monthly imports India', 'futtaim', 'quoted', 64000, 'referral', 'Nhava Sheva → Jebel Ali', 'sea_fcl'], ['Emirates Steel: coil imports', 'emsteel', 'lead', 220000, 'linkedin', 'Mumbai → Abu Dhabi', 'sea_fcl'],
      ['Gulf Retail: LCL seasonal', 'lulu', 'qualified', 41000, 'website', 'Colombo → Jebel Ali', 'sea_lcl'], ['Danube: Turkish tiles', 'danube', 'negotiation', 78000, 'expo', 'Istanbul → Jebel Ali', 'sea_fcl'],
      ['Noon: returns trucking', 'noon', 'won', 32000, 'referral', 'Jebel Ali → Dubai', 'road'], ['Aramex: Riyadh road link', 'aramex', 'lost', 54000, 'website', 'Dubai → Riyadh', 'road'],
    ] as const;
    for (const [title, cust, stage, value, source, lane, mode] of dealDefs) {
      const d = await sales.post('/deals', { title, customer_id: C[cust], stage, value, source, lane, mode, expected_close: day(20) });
      if (stage === 'lost') await sales.post(`/pipeline/deals/${d.id}/move`, { stage: 'lost', lost_reason: 'Price — competitor 8% cheaper' });
    }
    // stale high-probability deal for the Deal Coach agent
    await query(`UPDATE deals SET updated_at = now() - interval '11 days' WHERE tenant_id=$1 AND title LIKE 'Danube%'`, [tenant.id]);

    // ── quotes → shipments ──
    const quote = async (custKey: string, mode: string, origin: string, dest: string, items: any[], extra: any = {}) =>
      sales.post('/quotes', { customer_id: C[custKey], mode, origin, destination: dest, incoterm: 'CIF', cargo_description: extra.cargo || 'General cargo', items, ...extra });
    const q1 = await quote('noon', 'sea_fcl', 'Shanghai', 'Jebel Ali', [
      { rate_id: R[0], charge_type: 'freight', description: 'Ocean freight 40HC Shanghai–Jebel Ali', quantity: 2, unit_price: 5200 },
      { charge_type: 'thc', description: 'Terminal handling (Jebel Ali)', quantity: 2, unit_price: 1050 },
      { charge_type: 'customs_clearance', description: 'Customs clearance & documentation', quantity: 1, unit_price: 650 },
      { charge_type: 'trucking', description: 'Trucking Jebel Ali → Dubai warehouse', quantity: 2, unit_price: 600 },
    ], { cargo: 'Consumer electronics — 2x40HC', containers: '2x40HC' });
    const q2 = await quote('aramex', 'air', 'Hong Kong', 'Dubai (DXB)', [
      { rate_id: R[3], charge_type: 'freight', description: 'Air freight HKG–DXB (1,850 kg chargeable)', quantity: 1850, unit_price: 10.4 },
      { charge_type: 'handling', description: 'Airport handling & delivery order', quantity: 1, unit_price: 540 },
      { charge_type: 'customs_clearance', description: 'Customs clearance', quantity: 1, unit_price: 380 },
    ], { cargo: 'Mobile accessories', weight_kg: 1720 });
    const q3 = await quote('futtaim', 'sea_fcl', 'Nhava Sheva', 'Jebel Ali', [
      { rate_id: R[1], charge_type: 'freight', description: 'Ocean freight 40HC Nhava Sheva–Jebel Ali', quantity: 1, unit_price: 2650 },
      { charge_type: 'thc', description: 'Terminal handling (Jebel Ali)', quantity: 1, unit_price: 1050 },
      { charge_type: 'customs_clearance', description: 'Customs clearance', quantity: 1, unit_price: 450 },
    ], { cargo: 'Auto spare parts' });
    const q4 = await quote('lulu', 'sea_lcl', 'Colombo', 'Jebel Ali', [
      { rate_id: R[4], charge_type: 'freight', description: 'LCL freight Colombo–Jebel Ali (per CBM)', quantity: 18, unit_price: 130 },
      { charge_type: 'handling', description: 'CFS devanning & handling', quantity: 18, unit_price: 28 },
    ], { cargo: 'Packaged tea — 18 CBM' });
    // deliberately thin margin -> triggers the owner-approval policy
    // (owner sets the buy cost explicitly; sales users cannot see or set costs)
    const q5 = await owner_.post('/quotes', { customer_id: C.emsteel, mode: 'sea_fcl', origin: 'Mumbai', destination: 'Abu Dhabi', incoterm: 'CIF', cargo_description: 'Steel coils',
      items: [{ charge_type: 'freight', description: 'Ocean freight 40HC Mumbai–Khalifa Port', quantity: 3, unit_price: 2200, unit_cost: 2120 }] });
    const s5 = await owner_.post(`/quotes/${q5.id}/submit`);
    if (s5.status !== 'pending_approval') throw new Error('expected q5 to need approval, got ' + s5.status);
    // the owner is allowed to approve their own request; anyone else may not (segregation of duties)
    await owner_.post(`/approvals/${s5.approval.id}/decide`, { approve: true, note: 'Strategic customer — approved at thin margin' });
    await sales.post(`/quotes/${q5.id}/send`);

    for (const q of [q1, q2, q3, q4]) {
      const sub = await sales.post(`/quotes/${q.id}/submit`);
      if (sub.status === 'pending_approval') await owner_.post(`/approvals/${sub.approval.id}/decide`, { approve: true });
      await sales.post(`/quotes/${q.id}/send`);
    }
    await sales.post('/quotes', { customer_id: C.danube, mode: 'sea_fcl', origin: 'Istanbul', destination: 'Jebel Ali', items: [{ rate_id: R[7], charge_type: 'freight', description: 'Ocean freight 40HC Istanbul–Jebel Ali', quantity: 1, unit_price: 4100 }] }); // stays draft

    const acc = async (q: any) => (await sales.post(`/quotes/${q.id}/accept`)).shipment_id as string;
    const sh1 = await acc(q1), sh2 = await acc(q2), sh3 = await acc(q3), sh4 = await acc(q4);
    await sales.post(`/quotes/${q5.id}/accept`);

    // ── operations: enrich + advance shipments ──
    await ops.patch(`/shipments/${sh1}`, { container_no: containerNo('MSCU', 774211), bl_number: 'MEDU9912345', carrier: 'MSC', vessel: 'MSC AURORA', voyage: '2609W', pol: 'Shanghai', pod: 'Jebel Ali', etd: day(-22), eta: day(-2), pieces: 640, weight_kg: 18400, cargo_value: 410000, ops_owner_id: uid.operations });
    await ops.patch(`/shipments/${sh2}`, { awb_number: '176-48213377', carrier: 'Emirates SkyCargo', etd: day(-4), eta: day(-1), pieces: 84, weight_kg: 1720, cargo_value: 96000, ops_owner_id: uid.operations, priority: 'high' });
    await ops.patch(`/shipments/${sh3}`, { container_no: containerNo('MAEU', 553390), bl_number: 'MAEU220819907', carrier: 'Maersk', vessel: 'MAERSK SENTOSA', voyage: '2611E', pol: 'Nhava Sheva', pod: 'Jebel Ali', etd: day(-10), eta: day(-1), pieces: 320, weight_kg: 21500, cargo_value: 175000, ops_owner_id: uid.operations, free_days_end: new Date(Date.now() + 18 * 3_600_000).toISOString() });
    await ops.patch(`/shipments/${sh4}`, { carrier: 'MSC', etd: day(6), eta: day(24), pieces: 900, weight_kg: 7600, volume_cbm: 18, ops_owner_id: uid.operations });
    const step = async (id: string, ...statuses: string[]) => { for (const s of statuses) await ops.post(`/shipments/${id}/status`, { status: s }); };
    await step(sh1, 'confirmed', 'in_transit', 'arrived', 'customs');
    await step(sh2, 'confirmed', 'in_transit');
    await step(sh3, 'confirmed', 'in_transit', 'arrived', 'customs');
    await step(sh4, 'confirmed');

    // customs: sh1 clears; sh3 held (missing CoO)
    const d1 = (await customs.get(`/customs?shipment_id=${sh1}`)).data[0];
    await customs.patch(`/customs/${d1.id}`, { hs_code: '8517.13', description: 'Smartphones and accessories', origin_country: 'CN', cif_value: 410000 });
    await customs.post(`/customs/${d1.id}/status`, { status: 'submitted' });
    await customs.post(`/customs/${d1.id}/status`, { status: 'cleared' });
    const d3 = (await customs.get(`/customs?shipment_id=${sh3}`)).data[0];
    await customs.patch(`/customs/${d3.id}`, { hs_code: '8708.99', description: 'Automotive spare parts', origin_country: 'IN', cif_value: 175000 });
    await customs.post(`/customs/${d3.id}/status`, { status: 'submitted' });
    await customs.post(`/customs/${d3.id}/status`, { status: 'hold', hold_reason: 'Missing Certificate of Origin' });

    // ── transport: deliver sh1 with a real POD from the driver app ──
    const drv = await dispatch.post('/drivers', { name: 'Mohammed Iqbal', phone: '0501112233', license_no: 'DXB-4481920', license_expiry: day(400), visa_expiry: day(200), status: 'available', rating: 4.8 });
    await query('UPDATE drivers SET user_id=$2 WHERE id=$1', [drv.id, uid.driver]);
    const drv2 = await dispatch.post('/drivers', { name: 'Rashid Khan', phone: '0507778899', license_no: 'DXB-5521100', license_expiry: day(21), visa_expiry: day(300), status: 'available', rating: 4.5 });
    const veh = await dispatch.post('/vehicles', { plate: 'DXB K 48213', type: 'Prime mover + trailer', capacity_kg: 30000, mulkiya_expiry: day(120), insurance_expiry: day(90), status: 'available' });
    await dispatch.post('/vehicles', { plate: 'DXB M 90177', type: '10-ton truck', capacity_kg: 10000, mulkiya_expiry: day(9), insurance_expiry: day(200), status: 'available' });
    await dispatch.patch(`/drivers/${drv.id}`, { vehicle_id: veh.id });
    void drv2;
    await ops.post(`/shipments/${sh1}/status`, { status: 'cleared' });
    const trip = await dispatch.post('/dispatch/trips', { driver_id: drv.id, planned_date: day(0), stops: [
      { kind: 'pickup', address: 'Jebel Ali Port, Gate 4', lat: 25.0116, lng: 55.0613, shipment_id: sh1, contact_name: 'DP World gate', contact_phone: '0501111111' },
      { kind: 'delivery', address: 'Noon Fulfilment Centre, Dubai Investment Park', lat: 24.9857, lng: 55.1728, shipment_id: sh1, contact_name: 'Noon receiving', contact_phone: '0501234567' },
    ] });
    await driver.post(`/driver/trips/${trip.id}/start`);
    const myTrips = (await driver.get('/driver/trips')).data;
    const stops = myTrips.find((t: any) => t.id === trip.id).stops;
    await driver.post(`/driver/stops/${stops[0].id}/arrive`);
    await driver.post(`/driver/stops/${stops[0].id}/pod`, { client_id: 'seed-pod-pickup-0001', signed_by: 'DP World gate officer', signature: TINY_PNG, lat: 25.0116, lng: 55.0613 });
    await driver.post(`/driver/stops/${stops[1].id}/pod`, { client_id: 'seed-pod-delivery-0001', signed_by: 'Khalid (Noon receiving)', signature: TINY_PNG, photos: [TINY_PNG], lat: 24.9857, lng: 55.1728, notes: '640 cartons received in good order' });
    await driver.post('/driver/expenses', { client_id: 'seed-exp-0001', trip_id: trip.id, category: 'fuel', amount: 220, note: 'ADNOC Jebel Ali' });
    await driver.post('/driver/expenses', { client_id: 'seed-exp-0002', trip_id: trip.id, category: 'toll', amount: 1250, note: 'Salik + port gate fees (needs approval)' });
    // trip for sh2 awaiting assignment
    await dispatch.post('/dispatch/trips', { planned_date: day(1), stops: [{ kind: 'delivery', address: 'Aramex Hub, Dubai Airport Free Zone', shipment_id: sh2, contact_name: 'Aramex hub' }] });

    // ── finance: cost bills, invoices, receipts ──
    const detail1 = await fin.get(`/shipments/${sh1}/detail`);
    const costIds = detail1.charges.filter((c: any) => c.kind === 'cost').map((c: any) => c.id);
    const bill = await fin.post('/accounting/bills', { supplier_id: S.msc, charge_ids: costIds, supplier_ref: 'MSC-INV-88231' });
    const banks = (await fin.get('/accounts?is_bank=true')).data;
    await fin.post(`/accounting/bills/${bill.id}/pay`, { amount: bill.total, bank_account_id: banks[0].id, reference: 'TT-77120' });
    const inv1 = await fin.post(`/invoices/from-shipment/${sh1}`, { issue: true });
    await fin.post(`/invoices/${inv1.id}/payments`, { amount: Math.round(inv1.total * 0.6 * 100) / 100, bank_account_id: banks[0].id, reference: 'NOON-WIRE-5541' });

    // historical receivables (overdue) to exercise ageing + credit agent
    for (const [ck, base, ageDays] of [['futtaim', 14200, 44], ['futtaim', 8200, 20], ['danube', 15750, 9], ['lulu', 23800, 75]] as const) {
      const sh = (await ops.post('/shipments', { customer_id: C[ck], mode: 'sea_fcl', origin: 'Colombo', destination: 'Jebel Ali', cargo_description: 'Historical job', etd: day(-90), eta: day(-60) })).id;
      await ops.post(`/shipments/${sh}/charges`, { kind: 'revenue', charge_type: 'freight', description: 'Ocean freight', unit_amount: base * 0.7 });
      await ops.post(`/shipments/${sh}/charges`, { kind: 'revenue', charge_type: 'trucking', description: 'Delivery', unit_amount: base * 0.3 });
      await ops.post(`/shipments/${sh}/charges`, { kind: 'cost', charge_type: 'freight', description: 'Carrier cost', unit_amount: base * 0.62 });
      await step(sh, 'confirmed', 'in_transit', 'arrived', 'out_for_delivery', 'delivered');
      const i = await fin.post(`/invoices/from-shipment/${sh}`, { issue: true });
      await query(`UPDATE invoices SET issue_date = current_date - $2::int - 30, due_date = current_date - $2::int WHERE id=$1`, [i.id, ageDays]);
      await query(`UPDATE journal_entries SET entry_date = current_date - $2::int - 30 WHERE source='invoice' AND source_id=$1`, [i.id, ageDays]);
    }
    await query(`UPDATE invoices SET status='overdue' WHERE tenant_id=$1 AND status='sent' AND due_date < current_date`, [tenant.id]);

    // bank statement to reconcile
    await fin.post('/accounting/bank/import', { account_id: banks[0].id, rows: [
      { date: day(0), description: 'NOON-WIRE-5541 Noon.com payment', amount: Math.round(inv1.total * 0.6 * 100) / 100, reference: 'NOON-WIRE-5541' },
      { date: day(-3), description: 'TT-77120 MSC Mediterranean', amount: -bill.total, reference: 'TT-77120' },
      { date: day(-1), description: 'Bank charges', amount: -45 },
    ] });
    await fin.post('/accounting/bank/auto-match', { account_id: banks[0].id });
    await owner_.post('/accounting/journal', { memo: 'Owner capital injection', date: day(-40), lines: [{ account_id: banks[0].id, debit: 500000 }, { account_id: (await fin.get('/accounts?type=equity')).data[0].id, credit: 500000 }] });

    // ── warehouse ──
    for (const [code, zone, cap] of [['A1-01', 'A', 5000], ['A1-02', 'A', 5000], ['B2-04', 'B', 8000], ['C1-09', 'C', 3000]] as const) await wh.post('/warehouse/bins', { code, zone, capacity_kg: cap });
    const bins = (await wh.get('/warehouse/bins')).data;
    await wh.post('/warehouse/receive', { shipment_id: sh2, customer_id: C.aramex, description: 'Mobile accessories — cartons', pieces: 84, weight_kg: 1720, bin_id: bins[0].id });
    await wh.post('/warehouse/receive', { customer_id: C.lulu, description: 'Packaged tea — pallets', pieces: 36, weight_kg: 2400, volume_cbm: 18, bin_id: bins[2].id });

    // ── procurement, HR, projects, comms, growth ──
    await fin.post('/purchases', { kind: 'PR', description: 'Forklift battery replacement', category: 'Equipment', amount: 4200, supplier_id: S.dpw }).then((p) => fin.post(`/procurement/purchases/${p.id}/submit`));
    const bigPr = await fin.post('/purchases', { kind: 'PR', description: 'Reach truck — 2.5t', category: 'Equipment', amount: 68000, supplier_id: S.dpw });
    await fin.post(`/procurement/purchases/${bigPr.id}/submit`);

    const emps: [string, string, string, number, string, string, string][] = [
      ['Ahmed Al Mansouri', 'Management', 'Managing Director', 22000, '784199012345671', '10003', '0201234567890123456'.slice(0, 16)],
      ['Sara Al Hashimi', 'Sales', 'Sales Manager', 9500, '784198812345672', '10003', '0201234567890123457'.slice(0, 16)],
      ['Omar Farouk', 'Operations', 'Operations Manager', 11000, '784198512345673', '10003', '0201234567890123458'.slice(0, 16)],
      ['Layla Haddad', 'Customs', 'Customs Coordinator', 7800, '784199212345674', '10003', '0201234567890123459'.slice(0, 16)],
      ['Fatima Zahra', 'Finance', 'Accountant', 8600, '784198712345675', '10003', '0201234567890123460'.slice(0, 16)],
      ['Mohammed Iqbal', 'Transport', 'Driver', 3200, '784199512345676', '10003', '0201234567890123461'.slice(0, 16)],
    ];
    for (const [name, dept, pos, basic, eid, bank, acct] of emps) {
      await hr.post('/employees', { name, department: dept, position: pos, nationality: 'AE', joined_on: day(-700), basic, housing: Math.round(basic * 0.25), transport: 800, other_allowance: 300, person_id: '99' + eid.slice(3, 15), labour_card_no: 'LC' + eid.slice(6, 13), routing_code: '3033000' + bank.slice(-2), bank_name: 'Emirates NBD', iban: aeIban('033', acct.padEnd(16, '0')), eid_expiry: day(300), passport_expiry: day(800), visa_expiry: name.startsWith('Layla') ? day(19) : day(365) });
    }
    const emp = (await hr.get('/employees')).data;
    const leave = await hr.post('/leave-requests', { employee_id: emp[0].id, kind: 'annual', from_date: day(14), to_date: day(21) });
    await hr.post(`/hr/leave-requests/${leave.id}/submit`);
    await owner_.put('/admin/integrations/wps', { enabled: true, config: { establishment_id: '1234567890123', routing_code: '303300001' } });
    const prevMonth = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 7);
    const run = await hr.post('/payroll/runs', { period: prevMonth });
    const sub = await hr.post(`/payroll/runs/${run.id}/submit`);
    await owner_.post(`/approvals/${sub.id}/decide`, { approve: true, note: 'Payroll verified' });

    const prj = await ops.post('/projects', { name: 'Al Ain cold-chain warehouse fit-out', customer_id: C.emsteel, status: 'active', start_date: day(-20), end_date: day(70), budget: 380000, progress: 35, description: 'Racking, temperature zones and WMS onboarding' });
    for (const [title, status] of [['Site survey', 'done'], ['Racking procurement', 'doing'], ['WMS configuration', 'todo']] as const) await ops.post('/project-tasks', { project_id: prj.id, title, status, due_date: day(15), hours_est: 24 });

    const th = (await query(`INSERT INTO threads (tenant_id, customer_id, contact_name, channel, external_id, subject, unread, last_message_preview) VALUES ($1,$2,'Noon Logistics Desk','whatsapp','971501234567','DXB-4511 status',2,'Can you confirm the delivery slot tomorrow?') RETURNING id`, [tenant.id, C.noon])).rows[0].id;
    await query(`INSERT INTO messages (tenant_id, thread_id, direction, sender, body, channel) VALUES ($1,$2,'in','Noon Logistics Desk','Hi, can you confirm shipment DXB-4511 status?','whatsapp'), ($1,$2,'out','Omar Farouk','Hello! DXB-4511 cleared customs and is out for delivery today.','whatsapp'), ($1,$2,'in','Noon Logistics Desk','Can you confirm the delivery slot tomorrow?','whatsapp')`, [tenant.id, th]);
    await query(`INSERT INTO threads (tenant_id, contact_name, channel, external_id, subject, unread, last_message_preview) VALUES ($1,'Unknown sender','whatsapp','971559998877','Unknown sender — needs triage',1,'Need a quote for 20ft container from Jeddah')`, [tenant.id]);

    for (const [metric, score] of [['seo_health', 73], ['ai_visibility', 60], ['content_authority', 70]] as const) await owner_.post('/growth-metrics', { metric, score });
    for (const [title, cat, level, hrs] of [['UAE VAT for freight forwarders', 'Compliance', 'intermediate', 3], ['Incoterms 2020 in practice', 'Operations', 'beginner', 2], ['Customs HS classification', 'Customs', 'advanced', 4]] as const) await hr.post('/courses', { title, category: cat, level, duration_hrs: hrs, certificate: true, description: `${title} — practical course for forwarders` });
    await hr.post('/talent', { name: 'Reem Al Suwaidi', headline: 'Customs clearance specialist · 9 yrs', skills: ['HS classification', 'Dubai Trade', 'Mirsal 2'], verified: true, rating: 4.9, rate_per_day: 900, availability: 'available' });
    await hr.post('/talent', { name: 'Vikram Nair', headline: 'Freight rate analyst · Asia–ME lanes', skills: ['Rate management', 'Excel', 'Carrier negotiation'], verified: true, rating: 4.7, rate_per_day: 750, availability: 'busy' });

    await ops.post('/shipments/refresh-risk');
    logger.info({ tenant: tenant.slug }, 'demo data seeded');
    return { skipped: false, tenant: tenant.slug };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  seedDemo({ reset: process.argv.includes('--reset') })
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(r.skipped ? 'Demo tenant already present.' : `Seeded. Sign in with owner@alnoor.ae / ${DEMO_PASSWORD}  (other roles: sales@, ops@, customs@, dispatch@, warehouse@, finance@, hr@, driver@, portal@noon-demo.ae)`);
      return pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
