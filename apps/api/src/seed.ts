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
    const confirm = (id: string) => ops.post(`/shipments/${id}/confirm-booking`, {});
    // sh4 is a future sailing: tie it to a vessel we hold space on so the Modal Hub can count its TEU
    await ops.patch(`/shipments/${sh4}`, { vessel: 'MSC ORCHESTRA', voyage: '2618E' });
    await confirm(sh1); await step(sh1, 'in_transit', 'arrived', 'customs');
    await confirm(sh2); await step(sh2, 'in_transit');
    await confirm(sh3); await step(sh3, 'in_transit', 'arrived', 'customs');
    await confirm(sh4);

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


    // ── fleet register depth, equipment, carrier capacity, branch notes ──
    const vehs = (await dispatch.get('/vehicles')).data as any[];
    const byPlate = (p: string) => vehs.find((v) => v.plate === p)?.id as string;
    await dispatch.patch(`/vehicles/${byPlate('DXB K 48213')}`, { make_model: 'Volvo FH16 750', year: 2022, emirate: 'Dubai', odometer_km: 88450, next_service_km: 90000, fuel_pct: 78, salik_balance: 450, civil_defense_permit: true, current_location: 'Jebel Ali Port, Gate 4', status: 'on_trip' });
    await dispatch.patch(`/vehicles/${byPlate('DXB M 90177')}`, { make_model: 'Isuzu FVR 10T', year: 2021, emirate: 'Dubai', odometer_km: 45200, next_service_km: 50000, fuel_pct: 90, salik_balance: 380, civil_defense_permit: true, current_location: 'Dubai South yard' });
    for (const v of [
      { plate: 'AUH 19204', type: 'Prime mover + trailer', capacity_kg: 30000, make_model: 'Mercedes Actros 1845', year: 2021, emirate: 'Abu Dhabi', odometer_km: 142100, next_service_km: 150000, fuel_pct: 62, salik_balance: 620, civil_defense_permit: true, current_location: 'Khalifa Port gate', status: 'at_gate', mulkiya_expiry: day(300), insurance_expiry: day(300) },
      { plate: 'SHJ 33019', type: 'Flatbed 50T', capacity_kg: 50000, make_model: 'MAN TGX 26.480', year: 2019, emirate: 'Sharjah', odometer_km: 301500, next_service_km: 303100, fuel_pct: 35, salik_balance: 190, civil_defense_permit: false, current_location: 'Sharjah workshop', status: 'maintenance', mulkiya_expiry: day(30), insurance_expiry: day(30) },
      { plate: 'DXB 55021', type: '3-ton pickup', capacity_kg: 3000, make_model: 'Toyota Hilux', year: 2023, emirate: 'Dubai', odometer_km: 18900, next_service_km: 25000, fuel_pct: 84, salik_balance: 240, civil_defense_permit: false, current_location: 'Al Quoz', status: 'on_trip', mulkiya_expiry: day(400), insurance_expiry: day(400) },
    ]) await dispatch.post('/vehicles', v);
    for (const e of [
      { code: 'CH-4001', category: 'road_chassis', type: "40' skeletal container chassis", specs: '3-axle, twist locks', tare_kg: 4200, max_payload_kg: 38000, location: 'JAFZA Gate 4 yard', status: 'attached', assigned_to: 'DXB K 48213', last_inspection: day(-40) },
      { code: 'CH-2002', category: 'road_chassis', type: "20' skeletal container chassis", tare_kg: 2900, max_payload_kg: 28000, location: 'DIC staging yard', status: 'operational', last_inspection: day(-25) },
      { code: 'GS-3000', category: 'reefer_genset', type: 'Diesel under-mount genset SG-3000', specs: 'Clip-on 460V', tare_kg: 0, max_payload_kg: 0, location: 'Dubai South cold hub', status: 'attached', assigned_to: 'DXB M 90177', last_inspection: day(-10) },
      { code: 'CT-9001', category: 'sea_container', type: "40' high cube ISO container (SOC)", tare_kg: 3900, max_payload_kg: 28500, location: 'Jebel Ali T2', status: 'operational', last_inspection: day(-60) },
      { code: 'ULD-PMC-01', category: 'air_uld', type: 'PMC pallet 96x125 in', tare_kg: 120, max_payload_kg: 6800, location: 'DWC cargo terminal', status: 'depot', last_inspection: day(-15) },
    ]) await dispatch.post('/equipment', e);

    const inH = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
    for (const a of [
      { mode: 'sea', carrier: 'MSC', vessel: 'MSC ORCHESTRA', voyage: '2618E', route: 'Shanghai → Jebel Ali', cutoff_at: inH(26), allocated: 60, other_booked: 44, unit: 'TEU' },
      { mode: 'sea', carrier: 'CMA CGM', vessel: 'CMA CGM LA TRAVIATA', voyage: '088W', route: 'Jebel Ali → Mombasa', cutoff_at: inH(54), allocated: 40, other_booked: 41, unit: 'TEU' },
      { mode: 'sea', carrier: 'Maersk', vessel: 'MAERSK SENTOSA', voyage: '2612E', route: 'Nhava Sheva → Jebel Ali', cutoff_at: inH(76), allocated: 80, other_booked: 71, unit: 'TEU' },
      { mode: 'sea', carrier: 'Ocean Network Express', vessel: 'ONE COMMITMENT', voyage: '054E', route: 'Jebel Ali → Nhava Sheva', cutoff_at: inH(120), allocated: 100, other_booked: 38, unit: 'TEU' },
      { mode: 'air', carrier: 'Emirates SkyCargo', voyage: 'EK 047', route: 'DXB → FRA', cutoff_at: inH(5.7), allocated: 18000, other_booked: 12650, unit: 'kg' },
      { mode: 'air', carrier: 'Emirates SkyCargo', voyage: 'EK 073', route: 'DXB → LHR', cutoff_at: inH(9), allocated: 15000, other_booked: 14200, unit: 'kg' },
      { mode: 'air', carrier: 'Etihad Cargo', voyage: 'EY 0912', route: 'AUH → CDG', cutoff_at: inH(27), allocated: 12000, other_booked: 4300, unit: 'kg' },
      { mode: 'air', carrier: 'Emirates SkyCargo', voyage: 'EK 9821', route: 'DXB → JFK', cutoff_at: inH(33), allocated: 20000, other_booked: 8000, unit: 'kg' },
    ]) await ops.post('/capacity-allocations', a);
    for (const [i, p] of ([
      ['sea', 'equipment', '20GP', "20' General Purpose", 120, 96, 4, 'units'], ['sea', 'equipment', '40GP', "40' General Purpose", 80, 61, 3, 'units'], ['sea', 'equipment', '40HC', "40' High Cube", 140, 129, 5, 'units'],
      ['sea', 'equipment', '40RF', "40' Reefer", 36, 33, 2, 'units'], ['sea', 'yard', 'YARD', 'JAFZA depot yard', 900, 742, 0, 'TEU'],
      ['air', 'equipment', 'PMC', 'PMC pallets (96×125")', 40, 28, 1, 'units'], ['air', 'equipment', 'AKE', 'AKE containers', 90, 71, 3, 'units'], ['air', 'equipment', 'AAP', 'AAP / PLA pallets', 24, 9, 0, 'units'],
      ['air', 'cold_chain', 'COLD', '2–8 °C build-up positions', 24, 20, 0, 'positions'],
    ] as const).entries()) await ops.post('/equipment-pools', { mode: p[0], kind: p[1], code: p[2], label: p[3], total: p[4], in_use: p[5], damaged: p[6], unit: p[7], sort: i });

    // live jobs that consume carrier space (so the Modal Hub shows them against the allotments)
    const bookDirect = async (customer: string, mode: string, body: Record<string, any>, confirmBody: Record<string, any>) => {
      const id = (await ops.post('/shipments', { customer_id: C[customer], mode, ...body })).id as string;
      await ops.post(`/shipments/${id}/confirm-booking`, confirmBody);
      return id;
    };
    await bookDirect('aramex', 'air', { origin: 'Dubai (DXB)', destination: 'Frankfurt (FRA)', cargo_description: 'Pharmaceutical cold-chain, 6 pallets', weight_kg: 480, volume_cbm: 1, incoterm: 'CPT', cargo_value: 320000 }, { carrier: 'Emirates SkyCargo', voyage: 'EK 047', awb_number: '176-48219903' });
    await bookDirect('noon', 'air', { origin: 'Dubai (DXB)', destination: 'London (LHR)', cargo_description: 'Consumer electronics, 20 cartons', weight_kg: 2000, volume_cbm: 4, incoterm: 'DAP', cargo_value: 180000 }, { carrier: 'Emirates SkyCargo', voyage: 'EK 073', awb_number: '176-48219914' });
    await bookDirect('lulu', 'sea_lcl', { origin: 'Jebel Ali', destination: 'Mombasa', cargo_description: 'Household goods', weight_kg: 5200, volume_cbm: 16, incoterm: 'CFR', cargo_value: 42000 }, { carrier: 'CMA CGM', vessel: 'CMA CGM LA TRAVIATA', voyage: '088W' });
    await bookDirect('futtaim', 'sea_fcl', { origin: 'Nhava Sheva', destination: 'Jebel Ali', cargo_description: 'Auto parts', weight_kg: 18000, container_type: '40HC', containers: 2, incoterm: 'CIF', cargo_value: 96000 }, { carrier: 'Maersk', vessel: 'MAERSK SENTOSA', voyage: '2612E', container_no: containerNo('MAEU', 601122), bl_number: 'MAEU330012345' });
    await bookDirect('emsteel', 'road', { origin: 'Jebel Ali', destination: 'Abu Dhabi', cargo_description: 'Steel sections', weight_kg: 24000, incoterm: 'DAP', cargo_value: 88000 }, { carrier: 'Rapid Haulage LLC' });

    await owner_.post('/notes', { body: 'Customs amendment for the held Maersk job submitted at JAFZA Gate 4 counter. Broker is waiting with the physical seal.', priority: 'urgent' });
    await ops.post('/notes', { body: 'Terminal crane maintenance expected tonight 22:00–02:00. Please schedule container gate-ins before 21:30.', priority: 'normal' });
    await fin.post('/notes', { body: 'Gulf Retail promised payment before Thursday to restore full credit line.', priority: 'info' });

    // ── history for the Operational Velocity report: quote → job → booking confirmed → documents generated ──
    // Real orders go through the real endpoints; only the *clock* is moved back afterwards, per mode, so the report has weeks of data.
    const walkin = (await sales.post('/customers', { name: 'Walk-in Trader LLC', type: 'shipper', email: 'walkin@example.ae', city: 'Dubai', country: 'AE' })).id as string; // no TRN on file
    let seed = 20260929;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
    const profiles = [
      { mode: 'sea_fcl', n: 9, job: [3, 7], carrier: [22, 46], doc: [0.4, 0.9], lanes: [['Shanghai', 'Jebel Ali'], ['Jebel Ali', 'Mumbai'], ['Ningbo', 'Jebel Ali']], confirm: { carrier: 'MSC', vessel: 'MSC ORCHESTRA', voyage: '2610W', container_type: '40HC', containers: 1 } },
      { mode: 'sea_lcl', n: 4, job: [3, 7], carrier: [26, 44], doc: [0.4, 0.9], lanes: [['Jebel Ali', 'Mombasa'], ['Colombo', 'Jebel Ali']], confirm: { carrier: 'CMA CGM', vessel: 'CMA CGM LA TRAVIATA', voyage: '087W' } },
      { mode: 'air', n: 9, job: [3, 6], carrier: [6, 15], doc: [0.3, 0.8], lanes: [['Dubai (DXB)', 'Frankfurt (FRA)'], ['Dubai (DXB)', 'London (LHR)'], ['Abu Dhabi (AUH)', 'Paris (CDG)']], confirm: { carrier: 'Emirates SkyCargo', voyage: 'EK 9800' } },
      { mode: 'road', n: 10, job: [3, 6], carrier: [12, 24], doc: [0.4, 0.9], lanes: [['Jebel Ali', 'Al Ain'], ['Dubai', 'Riyadh'], ['Sharjah', 'Muscat']], confirm: { carrier: 'Rapid Haulage LLC' } },
    ] as const;
    const custKeys = ['noon', 'aramex', 'futtaim', 'emsteel', 'lulu', 'danube'];
    let k = 0;
    for (const p of profiles) {
      for (let i = 0; i < p.n; i++, k++) {
        const useWalkin = rnd() < 0.15;
        const cid = useWalkin ? walkin : C[custKeys[k % custKeys.length]];
        const [o, d] = p.lanes[i % p.lanes.length];
        const q = await sales.post('/quotes', { customer_id: cid, mode: p.mode, origin: o, destination: d, cargo_description: 'Historical order', containers: p.mode === 'sea_fcl' ? '1x40HC' : undefined,
          items: [{ charge_type: 'freight', description: `Freight ${o} → ${d}`, quantity: 1, unit_price: Math.round(between(1500, 9000)) }] });
        const sub = await sales.post(`/quotes/${q.id}/submit`);
        if (sub.status === 'pending_approval') await owner_.post(`/approvals/${sub.approval.id}/decide`, { approve: true });
        await sales.post(`/quotes/${q.id}/send`);
        const shId = (await sales.post(`/quotes/${q.id}/accept`)).shipment_id as string;
        await ops.post(`/shipments/${shId}/confirm-booking`, p.confirm);
        // move the clock: accepted → job created → booking confirmed → documents generated
        const jobMin = between(p.job[0], p.job[1]) + (useWalkin ? between(8, 15) : 0);
        const carrierMin = between(p.carrier[0], p.carrier[1]);
        const docMin = between(p.doc[0], p.doc[1]);
        const total = jobMin + carrierMin + docMin;
        const agoMin = (i + 1) * ((14 * 24 * 60) / p.n) * (0.55 + rnd() * 0.4) + total + 20;
        const t0 = Date.now() - agoMin * 60_000;
        const created = t0 + jobMin * 60_000, confirmed = created + carrierMin * 60_000, docs = confirmed + docMin * 60_000;
        const at = (ms: number) => new Date(ms).toISOString();
        await query(`UPDATE quotes SET accepted_at=$2, sent_at=$3 WHERE id=$1`, [q.id, at(t0), at(t0 - 3_600_000)]);
        await query(`UPDATE shipments SET created_at=$2, status='closed', delivered_at=$3 WHERE id=$1`, [shId, at(created), at(docs + 86_400_000)]);
        await query(`UPDATE milestones SET status='done', done_at = CASE WHEN code='booking' THEN $2::timestamptz ELSE $3::timestamptz END WHERE shipment_id=$1`, [shId, at(confirmed), at(docs + 3_600_000)]);
        await query(`UPDATE documents SET generated_at=$2::timestamptz + (random()*5) * interval '1 second', created_at=$2 WHERE shipment_id=$1 AND origin='generated'`, [shId, at(docs)]);
      }
    }

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
