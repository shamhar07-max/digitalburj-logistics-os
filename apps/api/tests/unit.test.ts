import { describe, expect, it } from 'vitest';
import { assessRisk } from '../src/services/risk';
import { buildSif, overlapDays, validateSif, dailyRate } from '../src/services/wps';
import { extractWithRules, isValidContainerNo } from '../src/services/docintel';
import { assertPublicHttps, matches, render } from '../src/services/automation';
import { buildInvoiceXml } from '../src/services/einvoice';
import { validateBody } from '../src/crud/validate';
import { encrypt, decrypt, encryptConfig, maskConfig } from '../src/lib/crypto';
import { revenueAccountFor, costAccountFor } from '../src/services/ledger';

describe('risk engine', () => {
  const now = new Date('2026-09-29T08:00:00Z');
  it('flags expired / expiring free time', () => {
    expect(assessRisk({ status: 'arrived', free_days_end: '2026-09-29T02:00:00Z' }, now).level).toBe('high');
    expect(assessRisk({ status: 'arrived', free_days_end: '2026-09-29T20:00:00Z' }, now)).toMatchObject({ level: 'high', reason: 'Free time ends in 12h' });
    expect(assessRisk({ status: 'arrived', free_days_end: '2026-10-01T06:00:00Z' }, now).level).toBe('medium');
  });
  it('flags customs hold and ETA slippage', () => {
    expect(assessRisk({ status: 'customs', customs_status: 'hold', customs_hold_reason: 'Missing CoO' }, now).reason).toContain('Missing CoO');
    expect(assessRisk({ status: 'in_transit', eta: '2026-09-26' }, now)).toMatchObject({ level: 'high' });
    expect(assessRisk({ status: 'in_transit', eta: '2026-09-28' }, now).level).toBe('medium');
  });
  it('closed jobs are low risk, delivered jobs without POD are medium', () => {
    expect(assessRisk({ status: 'closed', customs_status: 'hold' }, now).level).toBe('low');
    expect(assessRisk({ status: 'delivered', pod_overdue_days: 3 }, now).level).toBe('medium');
  });
});

describe('WPS / SIF', () => {
  const employer = { establishment_id: '1234567890123', routing_code: '303300001' };
  const row = { name: 'A', person_id: '99123456789012', routing_code: '303300003', iban: 'AE070331234567890123456', days: 30, fixed: 10000.5, variable: 250, leave_days: 0 };
  it('builds EDR + SCR records with correct totals', () => {
    const f = buildSif(employer, '2026-08', [row, { ...row, name: 'B', fixed: 5000 }], new Date('2026-09-05T09:30:00Z'));
    const lines = f.content.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('EDR,99123456789012,303300003,AE070331234567890123456,2026-08-01,2026-08-31,30,10000.50,250.00,0');
    expect(lines[2]).toBe('SCR,1234567890123,303300001,2026-09-05,0930,082026,2,15500.50,AED,');
    expect(f.total).toBe(15500.5);
    expect(f.filename).toMatch(/^1234567890123260905\d{6}\.SIF$/);
  });
  it('validates identifiers before letting a file be produced', () => {
    expect(validateSif(employer, [row])).toEqual([]);
    const errs = validateSif({ establishment_id: '12' }, [{ ...row, person_id: '1', iban: 'GB00' }]);
    expect(errs.length).toBeGreaterThanOrEqual(4);
  });
  it('unpaid leave overlap + daily rate', () => {
    expect(overlapDays('2026-08-28', '2026-09-03', '2026-08')).toBe(4);
    expect(overlapDays('2026-07-01', '2026-07-10', '2026-08')).toBe(0);
    expect(dailyRate(9000)).toBe(300);
  });
});

describe('document intelligence rules', () => {
  it('ISO 6346 check digits', () => {
    expect(isValidContainerNo('CSQU3054383')).toBe(true);
    expect(isValidContainerNo('CSQU3054384')).toBe(false);
    expect(isValidContainerNo('bad')).toBe(false);
  });
  it('extracts key BL fields and warns on bad container numbers', () => {
    const text = `BILL OF LADING
B/L No: MEDU9912345
Shipper: Shenzhen Bright Electronics Co
Consignee: Noon.com (Namshi FZ-LLC)
Port of Loading: Shanghai
Port of Discharge: Jebel Ali
Container: CSQU3054383 / MSCU1234567
Gross Weight: 18,400.50 KGS
Description of Goods: Consumer electronics
Freight Prepaid`;
    const r = extractWithRules('BL', text);
    expect(r.fields.bl_number).toBe('MEDU9912345');
    expect(r.fields.port_of_discharge).toBe('Jebel Ali');
    expect(r.fields.gross_weight_kg).toBe(18400.5);
    expect(r.fields.container_numbers).toContain('CSQU3054383');
    expect(r.warnings.some((w) => w.includes('MSCU1234567'))).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.4);
  });
  it('extracts invoice essentials', () => {
    const r = extractWithRules('INVOICE', 'Invoice No: INV-2026-0042\nDate: 2026-09-01\nSeller: Acme Ltd\nBuyer: Al Noor Trading\nCIF Dubai\nTotal Amount USD 12,450.00\nCountry of Origin: China');
    expect(r.fields).toMatchObject({ invoice_number: 'INV-2026-0042', currency: 'USD', incoterm: 'CIF', total_amount: 12450 });
  });
});

describe('automation helpers', () => {
  it('renders templates safely', () => {
    expect(render('Shipment {{number}} → {{a.b}}', { number: 'DXB-1', a: { b: 'ok' } })).toBe('Shipment DXB-1 → ok');
    expect(render('{{__proto__.x}} {{missing}}', {})).toBe(' ');
  });
  it('evaluates conditions', () => {
    expect(matches([{ field: 'to', op: 'eq', value: 'delivered' }, { field: 'amt', op: 'gte', value: 100 }], { to: 'delivered', amt: 150 })).toBe(true);
    expect(matches([{ field: 'to', op: 'in', value: ['a', 'b'] }], { to: 'c' })).toBe(false);
    expect(matches([], {})).toBe(true);
  });
  it('blocks SSRF targets', async () => {
    await expect(assertPublicHttps('http://example.com/hook')).rejects.toThrow(/https/);
    await expect(assertPublicHttps('https://127.0.0.1/hook')).rejects.toThrow(/public/);
    await expect(assertPublicHttps('https://169.254.169.254/latest')).rejects.toThrow(/public/);
    await expect(assertPublicHttps('https://10.0.0.5/x')).rejects.toThrow(/public/);
  });
});

describe('e-invoice XML', () => {
  const inv = { number: 'INV-8841', kind: 'tax_invoice', issue_date: '2026-09-29', due_date: '2026-10-29', currency: 'AED', subtotal: 1500, vat: 25, total: 1525 };
  const items = [
    { description: 'Ocean freight <FCL> & fees', quantity: 1, unit_price: 1000, tax_code: 'Z', net: 1000, vat: 0, total: 1000 },
    { description: 'Trucking', quantity: 1, unit_price: 500, tax_code: 'S', net: 500, vat: 25, total: 525 },
  ];
  it('produces UBL with per-category tax subtotals and escapes text', () => {
    const xml = buildInvoiceXml(inv, items, { name: 'Al Noor', trn: '100420987600003' }, { name: 'Noon & Co', trn: '100312345600003' });
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="AED">1525.00</cbc:PayableAmount>');
    expect(xml).toContain('Ocean freight &lt;FCL&gt; &amp; fees');
    expect(xml).toContain('<cbc:ID>Z</cbc:ID><cbc:Percent>0.00</cbc:Percent>');
    expect(xml).toContain('<cbc:ID>S</cbc:ID><cbc:Percent>5.00</cbc:Percent>');
    expect((xml.match(/<cac:TaxSubtotal>/g) || []).length).toBe(2);
  });
  it('credit notes use type 381', () => {
    expect(buildInvoiceXml({ ...inv, kind: 'credit_note' }, items, { name: 'A' }, { name: 'B' })).toContain('<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>');
  });
});

describe('CRUD validation', () => {
  const cols: any[] = [{ n: 'name', t: 'text', req: true, max: 5 }, { n: 'qty', t: 'int', min: 1 }, { n: 'ok', t: 'bool' }, { n: 'when', t: 'date' }, { n: 'ro', t: 'text', ro: true }, { n: 'tags', t: 'textarr' }];
  it('coerces and strips read-only fields', () => {
    expect(validateBody(cols, { name: ' abc ', qty: '3', ok: 'true', when: '2026-09-29T10:00:00Z', ro: 'x', tags: 'a, b' }, false)).toEqual({ name: 'abc', qty: 3, ok: true, when: '2026-09-29', tags: ['a', 'b'] });
  });
  it('reports every field error', () => {
    try {
      validateBody(cols, { qty: 0, when: 'nope' }, false);
      throw new Error('should have thrown');
    } catch (e: any) {
      expect(e.details).toMatchObject({ name: ['is required'], qty: [expect.stringContaining('at least')], when: [expect.stringContaining('date')] });
    }
  });
  it('partial updates do not require required fields', () => {
    expect(validateBody(cols, { qty: 2 }, true)).toEqual({ qty: 2 });
  });
});

describe('crypto + ledger maps', () => {
  it('AES-GCM round-trips and detects tampering', () => {
    const c = encrypt('secret-token');
    expect(c.startsWith('enc:')).toBe(true);
    expect(decrypt(c)).toBe('secret-token');
    expect(() => decrypt(c.slice(0, -4) + 'AAAA')).toThrow();
  });
  it('secret-looking config values are encrypted and masked', () => {
    const enc = encryptConfig({ api_key: 'k123', from: 'a@b.ae' });
    expect(enc.api_key).toMatch(/^enc:/);
    expect(enc.from).toBe('a@b.ae');
    expect(maskConfig(enc)).toEqual({ api_key: '********', from: 'a@b.ae' });
    expect(encryptConfig({ api_key: '********' }, enc).api_key).toBe(enc.api_key); // unchanged when UI echoes the mask
  });
  it('maps charge types to GL accounts', () => {
    expect(revenueAccountFor('freight')).toBe('4000');
    expect(revenueAccountFor('trucking')).toBe('4200');
    expect(costAccountFor('customs_clearance')).toBe('5100');
    expect(costAccountFor('weird')).toBe('5900');
  });
});
