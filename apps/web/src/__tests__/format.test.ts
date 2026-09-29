import { describe, expect, it } from 'vitest';
import { aed, ago, describeActivity, fdate, initials, label, portalStatus, tone } from '../lib/format';

describe('format helpers', () => {
  it('formats AED with two decimals and compact mode', () => {
    expect(aed(1526.05)).toBe('AED 1,526.05');
    expect(aed(0)).toBe('AED 0.00');
    expect(aed(684000, { compact: true })).toBe('AED 684K');
    expect(aed(1_250_000, { compact: true, noSymbol: true })).toBe('1.25M');
  });
  it('formats dates without timezone drift for date-only strings', () => {
    expect(fdate('2026-09-29')).toBe('29 Sept 2026'.replace('Sept', new Date('2026-09-29T00:00:00').toLocaleDateString('en-GB', { month: 'short' })));
    expect(fdate(null)).toBe('—');
    expect(fdate('garbage')).toBe('—');
  });
  it('describes audit rows in plain English', () => {
    expect(describeActivity('create', 'growth-metrics')).toBe('created growth score');
    expect(describeActivity('receipt', 'invoice')).toBe('recorded a payment on invoice');
    expect(describeActivity('status', 'shipment')).toBe('moved shipment');
  });
  it('never reveals billing state to customers', () => {
    expect(portalStatus('invoiced')).toBe('delivered');
    expect(portalStatus('closed')).toBe('delivered');
    expect(portalStatus('in_transit')).toBe('in_transit');
  });
  it('status tones and labels', () => {
    expect(tone('overdue')).toBe('bad');
    expect(tone('paid')).toBe('ok');
    expect(tone('unknown-status')).toBe('');
    expect(label('pending_approval')).toBe('Pending approval');
    expect(initials('Ahmed Al Mansouri')).toBe('AA');
  });
  it('relative time', () => {
    expect(ago(new Date().toISOString())).toBe('just now');
    expect(ago(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe('3h ago');
  });
});
