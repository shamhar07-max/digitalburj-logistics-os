// Browser end-to-end flows against a running stack seeded with `npm run db:seed`.
//   BASE_URL=http://localhost:3001 CHROME=/path/to/chrome node e2e/flows.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const SHOTS = process.env.SHOTS_DIR || './e2e-shots';
const PW = 'Demo@12345!';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const results = [];
const api = async (token, method, path, body) => {
  const r = await fetch(BASE + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${JSON.stringify(j?.error)}`);
  return j;
};
const token = async (email) => (await api(null, 'POST', '/auth/login', { email, password: PW })).accessToken;

async function session(email, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, permissions: ['geolocation'], geolocation: { latitude: 25.2, longitude: 55.3 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|ERR_FAILED/.test(m.text())) page.errors.push('console: ' + m.text().slice(0, 160)); });
  page.on('response', (r) => { if (r.status() >= 500 && r.url().includes('/api/')) page.errors.push(`http ${r.status()} ${r.url()}`); });
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.fill('#e', email); await page.fill('#p', PW);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login')), page.click('button.btn.primary')]);
  return { ctx, page };
}
async function flow(name, fn) {
  const t0 = Date.now();
  try { const extra = await fn(); results.push({ name, ok: true, ms: Date.now() - t0, extra }); }
  catch (e) { results.push({ name, ok: false, ms: Date.now() - t0, error: String(e.message).split('\n')[0].slice(0, 300) }); }
}
const expectText = async (page, sel, re, timeout = 6000) => { await page.waitForFunction(([s, r]) => new RegExp(r, 'i').test(document.querySelector(s)?.textContent || ''), [sel, re.source], { timeout }); };

await flow('sales: build a quote from the rate card → submit → send → customer accepts → job created', async () => {
  const { ctx, page } = await session('sales@alnoor.ae');
  await page.goto(BASE + '/quotes/new', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1');
  await page.selectOption('#f-customer_id', { label: (await page.locator('#f-customer_id option').allTextContents()).find((t) => /Danube/.test(t)) });
  await page.selectOption('select[aria-label="Add from rate card"]', { index: 1 });
  const before = await page.locator('table.t tbody tr').count();
  await page.locator('input[aria-label="Quantity"]').first().fill('2');
  await page.screenshot({ path: `${SHOTS}/quote-builder.png` });
  await page.click('button:has-text("Create quote")');
  await page.waitForURL(/\/quotes\/[0-9a-f-]{36}/);
  await expectText(page, 'h1', /Q-\d+/);
  await page.click('button:has-text("Submit")');
  await page.waitForSelector('button:has-text("Mark as sent")', { timeout: 8000 });
  await page.click('button:has-text("Mark as sent")');
  await page.waitForSelector('button:has-text("Customer accepted")');
  await page.click('button:has-text("Customer accepted")');
  await page.waitForURL(/\/shipments\/[0-9a-f-]{36}/, { timeout: 10000 });
  await expectText(page, 'h1', /DXB-\d+/);
  await page.click('button[role=tab]:has-text("Milestones")');
  const ms = await page.locator('.timeline .tl').count();
  if (ms < 5) throw new Error('expected milestones, got ' + ms);
  await page.screenshot({ path: `${SHOTS}/shipment-milestones.png` });
  if (page.errors.length) throw new Error(page.errors.join(' | '));
  await ctx.close();
  return { rows: before, milestones: ms };
});

await flow('pipeline: drag a deal to another stage and it persists', async () => {
  const { ctx, page } = await session('sales@alnoor.ae');
  await page.goto(BASE + '/pipeline', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.kcard');
  const card = page.locator('.kcard', { hasText: 'Emirates Steel' });
  await card.dragTo(page.locator('.col', { hasText: 'Qualified' }).locator('.col-b'));
  await page.waitForTimeout(800);
  const stage = (await api(await token('sales@alnoor.ae'), 'GET', '/deals?search=Emirates')).data[0].stage;
  if (stage !== 'qualified') throw new Error('deal stage is ' + stage);
  await ctx.close();
});

await flow('finance: open an overdue invoice and record a payment', async () => {
  const { ctx, page } = await session('finance@alnoor.ae');
  await page.goto(BASE + '/invoices', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table.t tbody tr');
  await page.locator('table.t tbody tr', { hasText: 'Overdue' }).first().click();
  await page.waitForSelector('button:has-text("Record payment")');
  await page.screenshot({ path: `${SHOTS}/invoice-modal.png` });
  await page.click('button:has-text("Record payment")');
  await page.waitForSelector('input#f-amount');
  await page.fill('input#f-amount', '1000');
  await page.selectOption('#f-bank_account_id', { index: 1 });
  await page.click('.modal-f button.primary:has-text("Save")');
  await page.waitForSelector('.toast:has-text("Payment recorded")', { timeout: 8000 });
  if (page.errors.length) throw new Error(page.errors.join(' | '));
  await ctx.close();
});

await flow('driver: start trip, draw a signature, confirm delivery (POD) on a phone viewport', async () => {
  const ops = await token('ops@alnoor.ae'), dsp = await token('dispatch@alnoor.ae');
  const ships = (await api(ops, 'GET', '/shipments?status=in_transit')).data;
  const s = ships[0]; if (!s) throw new Error('no in_transit shipment to deliver');
  await api(ops, 'POST', `/shipments/${s.id}/status`, { status: 'arrived' });
  const drivers = (await api(dsp, 'GET', '/drivers')).data;
  const mohammed = drivers.find((d) => d.name === 'Mohammed Iqbal');
  await api(dsp, 'POST', '/dispatch/trips', { driver_id: mohammed.id, planned_date: new Date().toISOString().slice(0, 10), stops: [{ kind: 'delivery', address: 'E2E test site, Dubai', shipment_id: s.id, lat: 25.2, lng: 55.3 }] });
  const { ctx, page } = await session('driver@alnoor.ae', { width: 390, height: 844 });
  await page.goto(BASE + '/driver', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.stop');
  await page.locator('button:has-text("Start trip")').first().click();
  await page.waitForSelector('button:has-text("Capture POD")', { timeout: 8000 });
  await page.click('button:has-text("Capture POD")');
  await page.waitForSelector('canvas.sig');
  await page.fill('#rn', 'E2E Receiver');
  const box = await page.locator('canvas.sig').boundingBox();
  await page.mouse.move(box.x + 30, box.y + 60); await page.mouse.down();
  for (let i = 1; i < 12; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + 60 + Math.sin(i) * 30, { steps: 3 });
  await page.mouse.up();
  await page.screenshot({ path: `${SHOTS}/driver-pod.png` });
  await page.click('button:has-text("Confirm delivery")');
  await page.waitForSelector('.toast:has-text("Delivery confirmed")', { timeout: 10000 });
  const st = (await api(ops, 'GET', `/shipments/${s.id}`)).status;
  if (st !== 'delivered') throw new Error('shipment status ' + st);
  if (page.errors.length) throw new Error(page.errors.join(' | '));
  await ctx.close();
  return { shipment: s.number, now: st };
});

await flow('driver app queues a POD offline and syncs it when the connection returns', async () => {
  const ops = await token('ops@alnoor.ae'), dsp = await token('dispatch@alnoor.ae');
  const s = (await api(ops, 'GET', '/shipments?status=confirmed')).data[0]; if (!s) throw new Error('no confirmed shipment');
  await api(ops, 'POST', `/shipments/${s.id}/status`, { status: 'in_transit' }); await api(ops, 'POST', `/shipments/${s.id}/status`, { status: 'arrived' });
  const mohammed = (await api(dsp, 'GET', '/drivers')).data.find((d) => d.name === 'Mohammed Iqbal');
  await api(dsp, 'POST', '/dispatch/trips', { driver_id: mohammed.id, planned_date: new Date().toISOString().slice(0, 10), stops: [{ kind: 'delivery', address: 'Offline test site', shipment_id: s.id }] });
  const { ctx, page } = await session('driver@alnoor.ae', { width: 390, height: 844 });
  await page.goto(BASE + '/driver', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.stop');
  await page.locator('button:has-text("Start trip")').first().click();
  await page.waitForSelector('button:has-text("Capture POD")', { timeout: 8000 });
  await ctx.setOffline(true);
  await page.click('button:has-text("Capture POD")');
  await page.waitForSelector('canvas.sig');
  await page.fill('#rn', 'Offline Receiver');
  const box = await page.locator('canvas.sig').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 40); await page.mouse.down(); await page.mouse.move(box.x + 200, box.y + 100, { steps: 6 }); await page.mouse.up();
  await page.click('button:has-text("Confirm delivery")');
  await page.waitForSelector('.toast:has-text("offline")', { timeout: 8000 });
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('db-driver-queue') || '[]').length);
  if (queued !== 1) throw new Error('expected 1 queued op, got ' + queued);
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('db-driver-queue') || '[]').length === 0, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const st = (await api(ops, 'GET', `/shipments/${s.id}`)).status;
  if (st !== 'delivered') throw new Error('after sync, shipment status ' + st);
  await ctx.close();
  return { synced: true };
});

await flow('permissions: editing a role’s matrix changes what that role can do', async () => {
  const { ctx, page } = await session('owner@alnoor.ae');
  await page.goto(BASE + '/permissions', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.thread');
  await page.locator('.thread', { hasText: 'Warehouse' }).first().click();
  const before = await api(await token('warehouse@alnoor.ae'), 'GET', '/auth/me');
  if (before.permissions.customers) throw new Error('warehouse already has customers');
  await page.locator('button[aria-label="Customers r"]').click();
  await page.click('button:has-text("Save changes")');
  await page.waitForSelector('.toast:has-text("Role updated")');
  await page.waitForTimeout(600);
  const after = await api(await token('warehouse@alnoor.ae'), 'GET', '/auth/me');
  if (!String(after.permissions.customers || '').includes('r')) throw new Error('permission not applied: ' + JSON.stringify(after.permissions.customers));
  await ctx.close();
});

await flow('command palette finds a shipment by number and navigates to it', async () => {
  const { ctx, page } = await session('owner@alnoor.ae');
  await page.waitForSelector('h1');
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.palette input');
  await page.fill('.palette input', 'DXB-451');
  await page.waitForSelector('.palette li button:has-text("DXB-451")', { timeout: 6000 });
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/shipments\/[0-9a-f-]{36}/);
  await ctx.close();
});

await flow('dark mode and Arabic RTL apply and persist', async () => {
  const { ctx, page } = await session('owner@alnoor.ae');
  await page.waitForSelector('h1');
  await page.click('button[aria-label="Toggle theme"]');
  await page.click('button[aria-label="Toggle language"]');
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, dir: document.documentElement.dir, nav: document.querySelector('.nav a')?.textContent }));
  if (st.theme !== 'dark' || st.dir !== 'rtl') throw new Error(JSON.stringify(st));
  await page.screenshot({ path: `${SHOTS}/dark-rtl.png` });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('h1');
  const st2 = await page.evaluate(() => document.documentElement.dir + '/' + document.documentElement.dataset.theme);
  if (st2 !== 'rtl/dark') throw new Error('not persisted: ' + st2);
  await ctx.close();
  return st;
});

await flow('public tracking page renders without login and hides billing state', async () => {
  const owner = await token('owner@alnoor.ae');
  const s = (await api(owner, 'GET', '/shipments?status=invoiced')).data[0];
  const ctx = await browser.newContext(); await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`${BASE}/track/${s.tracking_token}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1.mono');
  const txt = await page.locator('main').textContent();
  if (/invoiced/i.test(txt)) throw new Error('billing state leaked');
  await page.screenshot({ path: `${SHOTS}/public-tracking.png` });
  await ctx.close();
});

await flow('customer portal: sees own data only; accepts a sent quote', async () => {
  const sales = await token('sales@alnoor.ae');
  const cust = (await api(sales, 'GET', '/customers?search=Noon')).data[0];
  const q = await api(sales, 'POST', '/quotes', { customer_id: cust.id, mode: 'road', origin: 'Jebel Ali', destination: 'Dubai', items: [{ charge_type: 'trucking', description: 'Portal E2E haulage', quantity: 1, unit_price: 700 }] });
  await api(sales, 'POST', `/quotes/${q.id}/submit`); await api(sales, 'POST', `/quotes/${q.id}/send`);
  const { ctx, page } = await session('portal@noon-demo.ae');
  await page.waitForSelector('.kpi');
  await page.click('button[role=tab]:has-text("Quotes")');
  await page.locator('table.t tbody tr', { hasText: q.number }).locator('button:has-text("Accept")').click();
  await page.click('.modal-f button:has-text("Accept & book")');
  await page.waitForSelector('.toast:has-text("booking")', { timeout: 8000 });
  if (page.errors.length) throw new Error(page.errors.join(' | '));
  await ctx.close();
});

await browser.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${String(r.ms).padStart(5)}ms  ${r.name}${r.error ? '\n        → ' + r.error : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} flows passed`);
process.exit(failed ? 1 : 0);
