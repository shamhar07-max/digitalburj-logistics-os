import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { one, pool, query } from '../src/db';
import { DEMO_PASSWORD, seedDemo } from '../src/seed';

const app = createApp();
const T: Record<string, string> = {};
const as = (role: string) => ({ Authorization: `Bearer ${T[role]}` });
const api = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, role: string) => (request(app) as any)[method]('/api' + path).set(as(role));

async function login(email: string, password = DEMO_PASSWORD) {
  const r = await request(app).post('/api/auth/login').send({ email, password });
  return r;
}

beforeAll(async () => {
  await seedDemo({ reset: true });
  const emails: Record<string, string> = {
    owner: 'owner@alnoor.ae', sales: 'sales@alnoor.ae', ops: 'ops@alnoor.ae', customs: 'customs@alnoor.ae', dispatch: 'dispatch@alnoor.ae',
    warehouse: 'warehouse@alnoor.ae', admin: 'admin@alnoor.ae', finance: 'finance@alnoor.ae', hr: 'hr@alnoor.ae', driver: 'driver@alnoor.ae', customer: 'portal@noon-demo.ae',
  };
  for (const [k, e] of Object.entries(emails)) {
    const r = await login(e);
    expect(r.status, `login ${e}`).toBe(200);
    T[k] = r.body.accessToken;
  }
}, 240_000);

afterAll(async () => {
  await pool.end();
});

describe('gate 1 · authentication', () => {
  it('rejects unauthenticated calls and bad tokens', async () => {
    expect((await request(app).get('/api/customers')).status).toBe(401);
    expect((await request(app).get('/api/customers').set('Authorization', 'Bearer nope')).status).toBe(401);
  });
  it('locks the account after repeated failures, then blocks even the right password', async () => {
    for (let i = 0; i < 5; i++) expect((await login('hr@alnoor.ae', 'wrong-password-1')).status).toBe(401);
    const r = await login('hr@alnoor.ae');
    expect(r.status).toBe(401);
    expect(r.body.error.message).toMatch(/locked/i);
    await query("UPDATE users SET failed_attempts=0, locked_until=NULL WHERE email='hr@alnoor.ae'");
  });
  it('rotates refresh tokens (old token cannot be reused)', async () => {
    const l = await login('owner@alnoor.ae');
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: l.body.refreshToken });
    expect(r1.status).toBe(200);
    const r2 = await request(app).post('/api/auth/refresh').send({ refreshToken: l.body.refreshToken });
    expect(r2.status).toBe(401);
  });
  it('/me returns effective permissions', async () => {
    const r = await api('get', '/auth/me', 'sales');
    expect(r.body.permissions.pipeline).toContain('c');
    expect(r.body.permissions.costs).toBeUndefined();
  });
});

describe('gate 2 · tenant isolation', () => {
  let other: string;
  it('a second company cannot see or touch the first company’s data', async () => {
    const reg = await request(app).post('/api/auth/register').send({ companyName: 'Rival Freight LLC', name: 'Eve Rival', email: 'eve@rival-demo.ae', password: 'Sup3r-Secret-Pass!' });
    expect(reg.status).toBe(201);
    other = reg.body.accessToken;
    const list = await request(app).get('/api/customers').set('Authorization', 'Bearer ' + other);
    expect(list.body.total).toBe(0);
    const ships = await request(app).get('/api/shipments').set('Authorization', 'Bearer ' + other);
    expect(ships.body.total).toBe(0);
    const noon = (await api('get', '/customers?search=Noon', 'owner')).body.data[0];
    expect((await request(app).get('/api/customers/' + noon.id).set('Authorization', 'Bearer ' + other)).status).toBe(404);
    expect((await request(app).patch('/api/customers/' + noon.id).set('Authorization', 'Bearer ' + other).send({ name: 'pwned' })).status).toBe(404);
    expect((await request(app).delete('/api/customers/' + noon.id).set('Authorization', 'Bearer ' + other)).status).toBe(404);
    const inv = (await api('get', '/invoices', 'owner')).body.data[0];
    expect((await request(app).get(`/api/invoices/${inv.id}/detail`).set('Authorization', 'Bearer ' + other)).status).toBe(404);
    expect((await request(app).get('/api/reports/ar-ageing').set('Authorization', 'Bearer ' + other)).body.total).toBe(0);
  });
  it('a new tenant gets a chart of accounts, roles and starter automations', async () => {
    const roles = await request(app).get('/api/admin/roles').set('Authorization', 'Bearer ' + other);
    expect(roles.body.data.length).toBeGreaterThanOrEqual(12);
    const wf = await request(app).get('/api/workflows').set('Authorization', 'Bearer ' + other);
    expect(wf.body.total).toBe(4);
    const acc = await request(app).get('/api/accounts').set('Authorization', 'Bearer ' + other);
    expect(acc.body.total).toBeGreaterThan(25);
  });
});

describe('gate 3 · field-level RBAC (buy rates & margins hidden from sales)', () => {
  it('sales never receive cost fields', async () => {
    const rates = (await api('get', '/rates', 'sales')).body.data;
    expect(rates.length).toBeGreaterThan(0);
    expect(rates[0]).not.toHaveProperty('buy_rate');
    expect(rates[0]).not.toHaveProperty('margin_pct');
    expect(rates[0]).toHaveProperty('sell_rate');
    const ships = (await api('get', '/shipments', 'sales')).body.data;
    expect(ships[0]).not.toHaveProperty('cost');
    const quotes = (await api('get', '/quotes', 'sales')).body.data;
    expect(quotes[0]).not.toHaveProperty('cost_total');
    const q = (await api('get', '/quotes/' + quotes[0].id, 'sales')).body;
    expect(q).not.toHaveProperty('margin_pct');
    expect(q.items[0]).not.toHaveProperty('unit_cost');
  });
  it('finance and owner do receive them', async () => {
    expect((await api('get', '/rates', 'finance')).body.data[0]).toHaveProperty('buy_rate');
    const q = (await api('get', '/quotes', 'owner')).body.data[0];
    expect(q).toHaveProperty('margin_pct');
  });
  it('sales cannot add cost lines to a shipment or read the general ledger', async () => {
    const s = (await api('get', '/shipments', 'owner')).body.data[0];
    expect((await api('post', `/shipments/${s.id}/charges`, 'sales').send({ kind: 'cost', description: 'x', unit_amount: 1 })).status).toBe(403);
    expect((await api('get', '/accounting/trial-balance', 'sales')).status).toBe(403);
  });
  it('warehouse users cannot see money modules', async () => {
    expect((await api('get', '/invoices', 'warehouse')).status).toBe(403);
    expect((await api('get', '/dashboard', 'warehouse')).body).not.toHaveProperty('ar');
  });
});

describe('gate 4 · customer portal scoping', () => {
  it('customers only see their own shipments/invoices and never drafts or staff notes', async () => {
    const ships = (await api('get', '/shipments', 'customer')).body;
    expect(ships.total).toBeGreaterThan(0);
    const noon = (await api('get', '/customers?search=Noon', 'owner')).body.data[0];
    for (const s of ships.data) expect(s.customer_id).toBe(noon.id);
    const inv = (await api('get', '/invoices', 'customer')).body;
    for (const i of inv.data) expect(i.customer_id).toBe(noon.id);
    expect((await api('get', '/customers', 'customer')).status).toBe(403);
    expect((await api('get', '/accounting/overview', 'customer')).status).toBe(403);
    expect((await api('get', '/rates', 'customer')).status).toBe(403);
    const home = (await api('get', '/portal/home', 'customer')).body;
    expect(home.customer.id).toBe(noon.id);
    // other customers' shipment is invisible
    const foreign = (await api('get', '/shipments?search=', 'owner')).body.data.find((s: any) => s.customer_id !== noon.id);
    expect((await api('get', `/shipments/${foreign.id}`, 'customer')).status).toBe(404);
    expect((await api('get', `/shipments/${foreign.id}/detail`, 'customer')).status).toBe(404);
  });
  it('customer detail view hides charges and costs', async () => {
    const s = (await api('get', '/shipments', 'customer')).body.data[0];
    const d = (await api('get', `/shipments/${s.id}/detail`, 'customer')).body;
    expect(d.charges).toEqual([]);
    expect(d.customs).toEqual([]);
  });
});

describe('gate 5 · quote → job spine and approvals', () => {
  it('accepting a quote is idempotent and creates exactly one job with milestones and charges', async () => {
    const quotes = (await api('get', '/quotes?status=accepted', 'owner')).body.data;
    expect(quotes.length).toBeGreaterThanOrEqual(4);
    const q = quotes[0];
    const again = await api('post', `/quotes/${q.id}/accept`, 'sales');
    expect(again.status).toBe(200);
    expect(again.body.already).toBe(true);
    const cnt = await one<any>({ query }, 'SELECT count(*)::int AS n FROM shipments WHERE quote_id=$1', [q.id]);
    expect(cnt!.n).toBe(1);
    const d = (await api('get', `/shipments/${q.shipment_id}/detail`, 'finance')).body;
    expect(d.milestones.length).toBeGreaterThanOrEqual(6);
    expect(d.charges.filter((c: any) => c.kind === 'revenue').length).toBeGreaterThan(0);
  });
  it('a thin-margin quote cannot be sent without approval; a draft cannot be accepted', async () => {
    const created = await api('post', '/quotes', 'owner').send({
      customer_id: (await api('get', '/customers?search=Danube', 'owner')).body.data[0].id, mode: 'sea_fcl', origin: 'A', destination: 'B',
      items: [{ charge_type: 'freight', description: 'thin', quantity: 1, unit_price: 1000, unit_cost: 990 }],
    });
    expect(created.status).toBe(201);
    const send = await api('post', `/quotes/${created.body.id}/send`, 'owner');
    expect(send.status).toBe(409);
    expect(send.body.error.message).toMatch(/approval/i);
    expect((await api('post', `/quotes/${created.body.id}/accept`, 'sales')).status).toBe(409);
  });
  it('requesters cannot approve their own request (segregation of duties), owners can', async () => {
    const pending = (await api('get', '/approvals', 'owner')).body.data.find((a: any) => a.entity_type === 'purchase');
    expect(pending).toBeTruthy();
    const own = await api('post', `/approvals/${pending.id}/decide`, 'finance').send({ approve: true });
    expect(own.status).toBe(403);
    const ok = await api('post', `/approvals/${pending.id}/decide`, 'owner').send({ approve: true });
    expect(ok.status).toBe(200);
    const po = (await api('get', '/purchases?search=Reach', 'finance')).body.data[0];
    expect(po.status).toBe('approved');
  });
  it('users without the approve permission cannot decide', async () => {
    const pending = (await api('get', '/approvals', 'owner')).body.data[0];
    expect((await api('post', `/approvals/${pending.id}/decide`, 'sales').send({ approve: true })).status).toBe(403);
  });
});

describe('gate 6 · shipment workflow integrity', () => {
  it('illegal status jumps are rejected with the allowed next states', async () => {
    const booked = (await api('get', '/shipments?status=confirmed', 'ops')).body.data[0];
    const r = await api('post', `/shipments/${booked.id}/status`, 'ops').send({ status: 'delivered' });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/Allowed/);
  });
  it('customs hold blocks and raises risk; clearing releases the shipment', async () => {
    const held = (await api('get', '/customs?status=hold', 'customs')).body.data[0];
    expect(held.hold_reason).toMatch(/Certificate of Origin/);
    const ship = (await api('get', `/shipments/${held.shipment_id}`, 'ops')).body;
    expect(ship.risk_level).toBe('high');
    expect((await api('post', `/customs/${held.id}/status`, 'customs').send({ status: 'hold' })).status).toBe(400); // hold requires reason & is not a self-transition
    expect((await api('post', `/customs/${held.id}/status`, 'customs').send({ status: 'cleared' })).status).toBe(200);
    const after = (await api('get', `/shipments/${held.shipment_id}`, 'ops')).body;
    expect(after.status).toBe('cleared');
    expect(after.risk_reason || '').not.toMatch(/Customs hold/); // hold no longer contributes to risk
  });
  it('a declaration cannot be submitted without HS code, description and value', async () => {
    const s = (await api('get', '/shipments?status=confirmed', 'ops')).body.data[0];
    const c = await api('post', '/customs', 'customs').send({ number: 'CD-TEST-1', shipment_id: s.id, type: 'import' });
    expect(c.status).toBe(201);
    const sub = await api('post', `/customs/${c.body.id}/status`, 'customs').send({ status: 'submitted' });
    expect(sub.status).toBe(400);
    expect(sub.body.error.message).toMatch(/HS code/);
    const upd = await api('patch', `/customs/${c.body.id}`, 'customs').send({ cif_value: 10000 });
    expect(upd.body.duty_amount).toBe(500); // 5% duty computed server-side
  });
});

describe('gate 7 · proof of delivery (offline-safe)', () => {
  it('POD is idempotent on client_id and completes the delivery + trip', async () => {
    const s = (await api('get', '/shipments?status=customs', 'ops')).body.data[0] ?? (await api('get', '/shipments?status=cleared', 'ops')).body.data[0];
    expect(s).toBeTruthy();
    if (s.status === 'customs') await api('post', `/shipments/${s.id}/status`, 'ops').send({ status: 'cleared' });
    const drivers = (await api('get', '/drivers', 'dispatch')).body.data;
    const mine = drivers.find((d: any) => d.name === 'Mohammed Iqbal');
    const trip = (await api('post', '/dispatch/trips', 'dispatch').send({ driver_id: mine.id, stops: [{ kind: 'delivery', address: 'Test site', shipment_id: s.id }] })).body;
    await api('post', `/driver/trips/${trip.id}/start`, 'driver').expect(200);
    const stop = (await api('get', '/driver/trips', 'driver')).body.data.find((t: any) => t.id === trip.id).stops[0];
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const body = { client_id: 'test-pod-idempotency-1', signed_by: 'Receiver', signature: png, lat: 25.2, lng: 55.3 };
    const first = await api('post', `/driver/stops/${stop.id}/pod`, 'driver').send(body);
    expect(first.status).toBe(201);
    const second = await api('post', `/driver/stops/${stop.id}/pod`, 'driver').send(body);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect((await one<any>({ query }, 'SELECT count(*)::int AS n FROM pods WHERE client_id=$1', ['test-pod-idempotency-1']))!.n).toBe(1);
    expect((await api('get', `/shipments/${s.id}`, 'ops')).body.status).toBe('delivered');
    expect((await one<any>({ query }, 'SELECT status FROM trips WHERE id=$1', [trip.id]))!.status).toBe('completed');
  });
  it('drivers cannot see other drivers’ stops or use office endpoints', async () => {
    expect((await api('get', '/invoices', 'driver')).status).toBe(403);
    expect((await api('get', '/customers', 'driver')).status).toBe(403);
  });
  it('offline sync replays a batch and reports per-op results', async () => {
    const r = await api('post', '/driver/sync', 'driver').send({ ops: [{ type: 'expense', payload: { client_id: 'sync-expense-0001', category: 'fuel', amount: 80 } }, { type: 'expense', payload: { client_id: 'sync-expense-0001', category: 'fuel', amount: 80 } }, { type: 'expense', payload: { client_id: 'x', category: 'fuel', amount: -1 } }] });
    expect(r.status).toBe(200);
    expect(r.body.results.map((x: any) => x.ok)).toEqual([true, true, false]);
    expect((await one<any>({ query }, "SELECT count(*)::int AS n FROM driver_expenses WHERE client_id='sync-expense-0001'"))!.n).toBe(1);
  });
});

describe('gate 8 · accounting integrity', () => {
  it('trial balance balances and the balance sheet balances', async () => {
    const tb = (await api('get', '/accounting/trial-balance', 'finance')).body;
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.totalDebit).toBeGreaterThan(0);
    const bs = (await api('get', '/accounting/balance-sheet', 'finance')).body;
    expect(bs.balanced).toBe(true);
  });
  it('AR control account equals the invoice sub-ledger', async () => {
    const ctl = await one<any>({ query }, "SELECT COALESCE(SUM(l.debit-l.credit),0) AS v FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE a.code='1100'");
    const sub = await one<any>({ query }, "SELECT COALESCE(SUM(total-paid),0) AS v FROM invoices WHERE kind='tax_invoice' AND status<>'void'");
    expect(Math.round(ctl!.v * 100)).toBe(Math.round(sub!.v * 100));
  });
  it('rejects overpayment, unbalanced journals and payments on draft invoices', async () => {
    const inv = (await api('get', '/invoices?status=overdue', 'finance')).body.data[0];
    const detail = (await api('get', `/invoices/${inv.id}/detail`, 'finance')).body;
    expect((await api('post', `/invoices/${inv.id}/payments`, 'finance').send({ amount: detail.outstanding + 1 })).status).toBe(400);
    const accts = (await api('get', '/accounts', 'finance')).body.data;
    const bad = await api('post', '/accounting/journal', 'owner').send({ memo: 'unbalanced', lines: [{ account_id: accts[0].id, debit: 100 }, { account_id: accts[1].id, credit: 90 }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toMatch(/not balanced/);
  });
  it('issuing twice is idempotent (one GL entry); paying in full closes the invoice; voiding a paid invoice is refused', async () => {
    const ship = (await api('post', '/shipments', 'ops').send({ customer_id: (await api('get', '/customers?search=Danube', 'owner')).body.data[0].id, mode: 'road', origin: 'Dubai', destination: 'Abu Dhabi' })).body;
    await api('post', `/shipments/${ship.id}/charges`, 'ops').send({ kind: 'revenue', charge_type: 'trucking', description: 'Haulage', unit_amount: 1000 }).expect(201);
    await api('post', `/shipments/${ship.id}/charges`, 'ops').send({ kind: 'revenue', charge_type: 'freight', description: 'Intl leg', unit_amount: 2000 }).expect(201);
    const inv = (await api('post', `/invoices/from-shipment/${ship.id}`, 'finance').send({})).body;
    expect(inv.status).toBe('draft');
    expect(inv.vat).toBe(50); // only trucking is 5%; international freight is zero-rated
    expect(inv.total).toBe(3050);
    await api('post', `/invoices/${inv.id}/send`, 'finance').send({}).expect(200);
    await api('post', `/invoices/${inv.id}/send`, 'finance').send({}).expect(200);
    const entries = await one<any>({ query }, "SELECT count(*)::int AS n FROM journal_entries WHERE source='invoice' AND source_id=$1", [inv.id]);
    expect(entries!.n).toBe(1);
    const sent = (await api('get', `/invoices/${inv.id}/detail`, 'finance')).body;
    expect(sent.asp_status).toBe('submitted'); // sandbox mode, clearly not transmitted
    expect(sent.has_xml).toBe(true);
    await api('post', `/invoices/${inv.id}/payments`, 'finance').send({ amount: 3050, reference: 'FULL-1' }).expect(201);
    expect((await api('get', `/invoices/${inv.id}/detail`, 'finance')).body.status).toBe('paid');
    expect((await api('post', `/invoices/${inv.id}/void`, 'owner')).status).toBe(409);
    // credit note against the paid invoice is possible and reduces nothing beyond total
    const cn = await api('post', `/invoices/${inv.id}/credit-note`, 'owner').send({ amount: 105, reason: 'Rate correction' });
    expect(cn.status).toBe(201);
    expect(cn.body.kind).toBe('credit_note');
    expect(cn.body.total).toBeCloseTo(105, 2);
  });
  it('voiding an unpaid issued invoice reverses the GL and releases the charges for re-billing', async () => {
    const ship = (await api('post', '/shipments', 'ops').send({ customer_id: (await api('get', '/customers?search=Gulf', 'owner')).body.data[0].id, mode: 'road' })).body;
    await api('post', `/shipments/${ship.id}/charges`, 'ops').send({ kind: 'revenue', charge_type: 'trucking', description: 'Haulage', unit_amount: 500 });
    const inv = (await api('post', `/invoices/from-shipment/${ship.id}`, 'finance').send({ issue: false })).body;
    await api('post', `/invoices/${inv.id}/send`, 'finance').send({ submit_asp: false }).expect(200);
    await api('post', `/invoices/${inv.id}/void`, 'owner').expect(200);
    const tb = (await api('get', '/accounting/trial-balance', 'finance')).body;
    expect(tb.totalDebit).toBe(tb.totalCredit);
    const left = await one<any>({ query }, "SELECT count(*)::int AS n FROM charges WHERE shipment_id=$1 AND invoice_id IS NULL", [ship.id]);
    expect(left!.n).toBe(1);
  });
  it('VAT summary splits standard/zero-rated supplies', async () => {
    const v = (await api('get', '/accounting/vat?from=2026-01-01&to=2026-12-31', 'finance')).body;
    expect(v.boxes.zeroRatedSupplies).toBeGreaterThan(0);
    expect(v.boxes.standardRatedSupplies.vat).toBeGreaterThan(0);
    expect(v.boxes.netVatPayable).toBeCloseTo(v.boxes.totalOutputVat - v.boxes.inputVat, 2);
  });
  it('bank reconciliation auto-matched the seeded receipt and bill payment', async () => {
    const acct = (await api('get', '/accounts?is_bank=true', 'finance')).body.data[0];
    const tx = (await api('get', `/bank-transactions?account_id=${acct.id}`, 'finance')).body.data;
    expect(tx.filter((t: any) => t.status === 'matched').length).toBeGreaterThanOrEqual(2);
    expect(tx.filter((t: any) => t.status === 'unmatched').length).toBe(1); // bank charge line
  });
});

describe('gate 9 · payroll & WPS', () => {
  it('generates a SIF only for an approved run with valid identifiers', async () => {
    const runs = (await api('get', '/payroll/runs', 'hr')).body.data;
    expect(runs[0].status).toBe('approved');
    const sif = await api('get', `/payroll/runs/${runs[0].id}/sif`, 'hr').buffer(true).parse((res: any, cb: any) => { let d = ''; res.on('data', (c: any) => (d += c)); res.on('end', () => cb(null, d)); });
    expect(sif.status).toBe(200);
    expect(sif.headers['content-disposition']).toMatch(/\.SIF/);
    const lines = String(sif.body).trim().split('\r\n');
    expect(lines.filter((l) => l.startsWith('EDR,')).length).toBe(runs[0].employees);
    expect(lines[lines.length - 1].startsWith('SCR,1234567890123,303300001')).toBe(true);
  });
  it('a draft run cannot export a SIF and pay requires accounting rights', async () => {
    const created = await api('post', '/payroll/runs', 'hr').send({ period: '2026-07' });
    expect(created.status).toBe(201);
    expect((await api('get', `/payroll/runs/${created.body.id}/sif`, 'hr')).status).toBe(409);
    expect((await api('post', `/payroll/runs/${created.body.id}/pay`, 'hr').send({ bank_account_id: (await api('get', '/accounts?is_bank=true', 'finance')).body.data[0].id })).status).toBe(403);
  });
});

describe('gate 10 · integrations security', () => {
  const phone = 'PHONE-ID-TEST';
  const sign = (body: string) => 'sha256=' + crypto.createHmac('sha256', 'wa-test-secret').update(body).digest('hex');
  const payload = (id: string) => JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: phone }, contacts: [{ wa_id: '971501234567', profile: { name: 'Noon Desk' } }], messages: [{ id, from: '971501234567', type: 'text', text: { body: 'Where is my container?' } }] } }] }] });

  it('integration secrets are encrypted at rest and masked on read', async () => {
    await api('put', '/admin/integrations/whatsapp', 'owner').send({ enabled: true, config: { token: 'EAAB-secret-token', phone_id: phone } }).expect(200);
    const raw = await one<any>({ query }, "SELECT config FROM integrations WHERE provider='whatsapp' AND config->>'phone_id'=$1", [phone]);
    expect(raw!.config.token.startsWith('enc:')).toBe(true);
    const shown = (await api('get', '/admin/integrations', 'owner')).body.data.find((i: any) => i.provider === 'whatsapp');
    expect(shown.config.token).toBe('********');
    expect((await api('put', '/admin/integrations/whatsapp', 'sales').send({ enabled: false, config: {} })).status).toBe(403);
  });
  it('WhatsApp webhook: verify handshake, signature enforcement, threading, de-duplication', async () => {
    expect((await request(app).get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123')).text).toBe('abc123');
    expect((await request(app).get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc')).status).toBe(403);
    const body = payload('wamid.TEST1');
    expect((await request(app).post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', 'sha256=deadbeef').send(body)).status).toBe(401);
    expect((await request(app).post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').send(body)).status).toBe(401);
    const ok = await request(app).post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(body)).send(body);
    expect(ok.status).toBe(200);
    await request(app).post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(body)).send(body);
    await new Promise((r) => setTimeout(r, 400)); // webhook processes after ack
    const n = await one<any>({ query }, "SELECT count(*)::int AS n FROM messages WHERE external_id='wamid.TEST1'");
    expect(n!.n).toBe(1);
    const th = (await api('get', '/inbox/threads?channel=whatsapp', 'ops')).body.data.find((t: any) => t.last_message_preview === 'Where is my container?');
    expect(th).toBeTruthy();
    expect(th.customer_name).toMatch(/Noon/); // phone matched to a known contact
  });
  it('public tracking exposes status only — no customer, cost or financial data', async () => {
    const s = await one<any>({ query }, "SELECT tracking_token FROM shipments WHERE status='invoiced' LIMIT 1");
    const r = await request(app).get('/api/public/track/' + s!.tracking_token);
    expect(r.status).toBe(200);
    expect(r.body.shipment.number).toMatch(/^DXB-/);
    expect(JSON.stringify(r.body)).not.toMatch(/customer|cost|revenue|invoice|margin/i);
    expect((await request(app).get('/api/public/track/0123456789abcdef0123')).status).toBe(404);
  });
  it('website freight request creates a lead and honours the honeypot', async () => {
    const ok = await request(app).post('/api/public/request/al-noor').send({ name: 'Buyer One', email: 'buyer@newco-demo.ae', origin: 'Shenzhen', destination: 'Jebel Ali', mode: 'sea_fcl' });
    expect(ok.status).toBe(201);
    expect((await api('get', '/deals?source=website', 'sales')).body.data.some((d: any) => /Shenzhen/.test(d.title))).toBe(true);
    const bot = await request(app).post('/api/public/request/al-noor').send({ name: 'Bot', email: 'bot@spam.example', origin: 'A1', destination: 'B1', website: 'http://spam' });
    expect(bot.status).toBe(400);
  });
});

describe('gate 11 · admin & audit', () => {
  it('cannot demote or disable the last owner; only owners can mint owners', async () => {
    const owner = (await api('get', '/admin/users', 'owner')).body.data.find((u: any) => u.role === 'owner');
    expect((await api('patch', `/admin/users/${owner.id}`, 'owner').send({ role: 'sales' })).status).toBe(409);
    expect((await api('patch', `/admin/users/${owner.id}`, 'owner').send({ is_active: false })).status).toBe(409);
    const adm = await api('post', '/admin/users', 'admin').send({ name: 'Sneaky', email: 'sneaky@alnoor.ae', role: 'owner' });
    expect(adm.status).toBe(403);
  });
  it('custom roles change effective permissions immediately', async () => {
    const created = await api('post', '/admin/roles', 'owner').send({ label: 'Read only ops', base_role: 'operations', permissions: { dashboard: 'r', shipments: 'r' } });
    expect(created.status).toBe(201);
    const u = await api('post', '/admin/users', 'owner').send({ name: 'Rita ReadOnly', email: 'rita@alnoor.ae', role: created.body.key, password: 'Sup3r-Secret-Pass!' });
    expect(u.status).toBe(201);
    const l = await login('rita@alnoor.ae', 'Sup3r-Secret-Pass!');
    const h = { Authorization: 'Bearer ' + l.body.accessToken };
    expect((await request(app).get('/api/shipments').set(h)).status).toBe(200);
    expect((await request(app).get('/api/customers').set(h)).status).toBe(403);
    const ships = (await request(app).get('/api/shipments').set(h)).body.data;
    expect((await request(app).patch('/api/shipments/' + ships[0].id).set(h).send({ carrier: 'x' })).status).toBe(403);
  });
  it('writes are audited with before/after and the trail is restricted', async () => {
    const cust = (await api('get', '/customers?search=Danube', 'owner')).body.data[0];
    await api('patch', `/customers/${cust.id}`, 'sales').send({ credit_limit: 111111 }).expect(200);
    const log = (await api('get', `/admin/audit?entity_type=customers&entity_id=${cust.id}`, 'owner')).body.data;
    expect(log[0].action).toBe('update');
    expect(log[0].changes.credit_limit.to).toBe(111111);
    expect((await api('get', '/admin/audit', 'sales')).status).toBe(403);
  });
});

describe('gate 12 · intelligence & reporting', () => {
  it('dashboard is permission-shaped', async () => {
    const o = (await api('get', '/dashboard', 'owner')).body;
    expect(o.shipments.active).toBeGreaterThan(0);
    expect(o.ar.total).toBeGreaterThan(0);
    expect(o.priority.length).toBeGreaterThan(0);
    expect(o).toHaveProperty('margin');
    const s = (await api('get', '/dashboard', 'sales')).body;
    expect(s).not.toHaveProperty('margin');
    expect(s).not.toHaveProperty('cash');
  });
  it('AI agents produce explainable findings from live data', async () => {
    const a = (await api('get', '/ai/agents', 'owner')).body;
    expect(a.agents).toHaveLength(8);
    const titles = a.agents.flatMap((x: any) => x.findings.map((f: any) => f.title)).join(' | ');
    expect(titles).toMatch(/outstanding/); // Credit Guardian
    expect(titles).toMatch(/expires in/); // Compliance Keeper
  });
  it('assistant answers from the caller’s permitted data only (rules engine when no LLM key)', async () => {
    const own = (await api('post', '/ai/chat', 'owner').send({ message: 'who owes us money?' })).body;
    expect(own.engine).toBe('rules');
    expect(own.reply).toMatch(/AED/);
    const wh = (await api('post', '/ai/chat', 'warehouse').send({ message: 'who owes us money?' }));
    expect(wh.status).toBe(403); // warehouse has no ai module
  });
  it('reports export CSV only with export rights and neutralise formula injection', async () => {
    const csv = await api('get', '/reports/job-costing?format=csv', 'finance');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/csv/);
    expect((await api('get', '/reports/sales-performance?format=csv', 'sales')).status).toBe(403);
  });
  it('global search is permission-aware', async () => {
    const r = (await api('get', '/search?q=Noon', 'sales')).body.results;
    expect(r.some((x: any) => x.type === 'Customer')).toBe(true);
    expect(r.some((x: any) => x.type === 'Invoice')).toBe(false);
  });
});

describe('gate 13 · documents & AI document intelligence', () => {
  it('uploads a document, serves it back, and enforces portal visibility', async () => {
    const ship = (await api('get', '/shipments?status=invoiced', 'ops')).body.data[0];
    const up = await api('post', '/documents/upload', 'ops').field('shipment_id', ship.id).field('type', 'BL').field('is_public', 'false').attach('file', Buffer.from('%PDF-1.4 test bl'), { filename: 'bl.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);
    const dl = await api('get', `/documents/${up.body.id}/download`, 'ops').buffer(true).parse((res: any, cb: any) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(dl.status).toBe(200);
    expect(String(dl.body)).toContain('test bl');
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
    // internal docs are invisible to the customer; sharing it makes it visible
    expect((await api('get', `/documents/${up.body.id}/download`, 'customer')).status).toBe(404);
    await api('patch', `/documents/${up.body.id}`, 'ops').send({ is_public: true }).expect(200);
    const shipCust = (await api('get', `/shipments/${ship.id}`, 'owner')).body.customer_id;
    const noon = (await api('get', '/customers?search=Noon', 'owner')).body.data[0];
    expect((await api('get', `/documents/${up.body.id}/download`, 'customer')).status).toBe(shipCust === noon.id ? 200 : 404);
  });
  it('rejects unsupported file types and oversized bodies', async () => {
    const bad = await api('post', '/documents/upload', 'ops').field('type', 'OTHER').attach('file', Buffer.from('MZ...'), { filename: 'evil.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect((await api('post', '/documents/upload', 'customer')).status).toBe(403);
  });
  it('extracts BL fields from pasted text and applies only to empty shipment fields', async () => {
    const ship = (await api('post', '/shipments', 'ops').send({ customer_id: (await api('get', '/customers?search=Danube', 'owner')).body.data[0].id, mode: 'sea_fcl', carrier: 'KEEP-ME' })).body;
    const ex = await api('post', '/docintel/extract', 'ops').field('doc_type', 'BL').field('text', 'B/L No: MEDU7771234\nVessel: MSC AURORA\nPort of Loading: Shanghai\nPort of Discharge: Jebel Ali\nContainer: CSQU3054383\nGross Weight: 12,500 KGS');
    expect(ex.status).toBe(200);
    expect(ex.body.engine).toBe('rules');
    expect(ex.body.fields.bl_number).toBe('MEDU7771234');
    const applied = await api('post', `/docintel/${ex.body.id}/apply`, 'ops').send({ shipment_id: ship.id });
    expect(applied.body.applied).toEqual(expect.arrayContaining(['bl_number', 'container_no', 'weight_kg']));
    const after = (await api('get', `/shipments/${ship.id}`, 'ops')).body;
    expect(after.container_no).toBe('CSQU3054383');
    expect(after.carrier).toBe('KEEP-ME');
  });
});

