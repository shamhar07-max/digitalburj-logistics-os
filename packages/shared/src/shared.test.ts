import { describe, expect, it } from 'vitest';
import {
  PERMISSION_MATRIX, hasPermission, calcTotals, defaultTaxCode, ageBucket, ageingSummary, marginPct, dutyOnCif,
  canTransition, SHIPMENT_TRANSITIONS, MILESTONE_TEMPLATES, MODULES, ROLES,
  validTRN, validEmiratesID, validIbanAE, normalizeMsisdn, isWorkingDay, addWorkingDays, amountInWordsAED,
} from './index';

describe('uae', () => {
  it('validates TRN, Emirates ID, MSISDN', () => {
    expect(validTRN('100420987600003')).toBe(true);
    expect(validTRN('1004209876')).toBe(false);
    expect(validEmiratesID('784-1990-1234567-1')).toBe(true);
    expect(normalizeMsisdn('0501234567')).toBe('+971501234567');
    expect(normalizeMsisdn('12345')).toBeNull();
  });
  it('IBAN mod-97', () => {
    expect(validIbanAE('AE070331234567890123456')).toBe(true); // ISO 13616 documented sample
    expect(validIbanAE('AE070331234567890123457')).toBe(false);
  });
  it('working days skip Sat/Sun and holidays', () => {
    expect(isWorkingDay('2026-09-26')).toBe(false); // Saturday
    expect(isWorkingDay('2026-09-28')).toBe(true); // Monday
    expect(addWorkingDays('2026-09-25', 1)).toBe('2026-09-28'); // Fri -> Mon
    expect(isWorkingDay('2026-12-02')).toBe(false); // National Day
  });
  it('amount in words', () => {
    expect(amountInWordsAED(1526.05)).toBe('UAE Dirham One Thousand Five Hundred Twenty-Six and Five Fils Only');
    expect(amountInWordsAED(0)).toBe('UAE Dirham Zero Only');
  });
});

describe('rbac', () => {
  it('owner can do everything on every module', () => {
    for (const m of MODULES) expect(hasPermission(PERMISSION_MATRIX.owner, m, 'a')).toBe(true);
  });
  it('sales cannot see costs (buy rates hidden)', () => {
    expect(hasPermission(PERMISSION_MATRIX.sales, 'costs', 'r')).toBe(false);
    expect(hasPermission(PERMISSION_MATRIX.finance, 'costs', 'r')).toBe(true);
  });
  it('customer is read-only on invoices', () => {
    expect(hasPermission(PERMISSION_MATRIX.customer, 'invoices', 'r')).toBe(true);
    expect(hasPermission(PERMISSION_MATRIX.customer, 'invoices', 'c')).toBe(false);
  });
  it('every role has a matrix entry', () => {
    for (const r of ROLES) expect(PERMISSION_MATRIX[r]).toBeDefined();
  });
});

describe('vat', () => {
  it('zero-rates international freight and 5% on local handling', () => {
    expect(defaultTaxCode('freight')).toBe('Z');
    expect(defaultTaxCode('trucking')).toBe('S');
    expect(defaultTaxCode('duty')).toBe('O');
  });
  it('calculates totals with mixed tax codes', () => {
    const t = calcTotals([
      { quantity: 1, unit_price: 1000, tax_code: 'Z' },
      { quantity: 2, unit_price: 250.5, tax_code: 'S' },
    ]);
    expect(t.subtotal).toBe(1501);
    expect(t.vat).toBe(25.05);
    expect(t.total).toBe(1526.05);
  });
  it('rounds to 2dp', () => {
    expect(calcTotals([{ quantity: 3, unit_price: 0.333, tax_code: 'S' }]).total).toBe(1.05);
  });
});

describe('finance helpers', () => {
  it('margin %', () => {
    expect(marginPct(1000, 800)).toBe(20);
    expect(marginPct(0, 10)).toBe(0);
  });
  it('ageing buckets', () => {
    const asOf = new Date('2026-03-31');
    expect(ageBucket('2026-04-10', asOf)).toBe('current');
    expect(ageBucket('2026-03-20', asOf)).toBe('d1_30');
    expect(ageBucket('2026-02-10', asOf)).toBe('d31_60');
    expect(ageBucket('2026-01-20', asOf)).toBe('d61_90');
    expect(ageBucket('2025-10-01', asOf)).toBe('d90p');
    const s = ageingSummary([{ due_date: '2026-03-20', outstanding: 100 }, { due_date: '2026-03-25', outstanding: 50.5 }], asOf);
    expect(s.d1_30).toBe(150.5);
  });
  it('duty 5% on CIF', () => expect(dutyOnCif(10000)).toBe(500));
});

describe('workflow', () => {
  it('shipment transitions are directional', () => {
    expect(canTransition(SHIPMENT_TRANSITIONS, 'booked', 'confirmed')).toBe(true);
    expect(canTransition(SHIPMENT_TRANSITIONS, 'delivered', 'booked')).toBe(false);
  });
  it('every mode has a POD milestone last', () => {
    for (const k of Object.keys(MILESTONE_TEMPLATES)) {
      const t = (MILESTONE_TEMPLATES as any)[k];
      expect(t[t.length - 1].code).toBe('pod');
    }
  });
});
