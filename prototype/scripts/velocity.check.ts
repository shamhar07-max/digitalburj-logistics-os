/* Run with: npm run check:velocity — plain node:assert, no test framework needed. */
import assert from 'node:assert/strict';
import { buildVelocityRecords } from '../src/data/velocityData';
import { compareModes, diagnose, measure, modeGroup, percentile, summarise, toCsv, SLA_MINUTES } from '../src/utils/velocity';
import type { VelocityRecord } from '../src/types';

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓', name); };

const NOW = Date.parse('2026-09-29T12:00:00Z');
const at = (min: number) => new Date(NOW + min * 60_000).toISOString();
const rec = (over: Partial<VelocityRecord> & { j: number; c: number; d: number }): VelocityRecord => ({
  id: 'x', jobNo: 'J', quoteNo: 'Q', customer: 'C', mode: 'Air', lane: 'A → B',
  acceptedAt: at(0), jobCreatedAt: at(over.j), carrierConfirmedAt: at(over.j + over.c), docsGeneratedAt: at(over.j + over.c + over.d), ...over,
});

t('modeGroup maps every transport mode', () => {
  assert.equal(modeGroup('Sea FCL'), 'Sea'); assert.equal(modeGroup('Sea LCL'), 'Sea');
  assert.equal(modeGroup('Air'), 'Air'); assert.equal(modeGroup('Road GCC'), 'Road'); assert.equal(modeGroup('Rail'), null);
});

t('percentile interpolates', () => {
  assert.equal(percentile([], 50), 0); assert.equal(percentile([10], 90), 10);
  assert.equal(percentile([10, 20, 30, 40], 50), 25); assert.equal(percentile([1, 2, 3, 4, 5], 90), 4.6);
});

t('stage durations add up to Quote Accepted → Document Generation', () => {
  const { valid } = measure([rec({ j: 5, c: 30, d: 1 })]);
  assert.equal(valid[0].total, 36); assert.equal(valid[0].stages.carrierBooking, 30);
});

t('out-of-order and unparseable records are rejected, not turned into negative durations', () => {
  const bad1 = rec({ j: 5, c: 30, d: 1, carrierConfirmedAt: at(2) });
  const bad2 = rec({ j: 5, c: 30, d: 1, docsGeneratedAt: 'not-a-date' });
  const r = measure([bad1, bad2, rec({ j: 1, c: 1, d: 1 })]);
  assert.equal(r.valid.length, 1); assert.equal(r.rejected.length, 2);
  assert.deepEqual(r.rejected.map((x) => x.reason), ['timestamps out of order', 'unparseable timestamp']);
});

t('downstream customs time is captured but never added to the metric', () => {
  const r = measure([rec({ j: 5, c: 10, d: 1, customsValidatedAt: at(16 + 12) })]).valid[0];
  assert.equal(r.total, 16); assert.equal(r.downstream, 12);
});

t('per-mode summaries only include that mode and flag the dominant stage', () => {
  const { valid } = measure([
    rec({ mode: 'Sea FCL', j: 5, c: 50, d: 1 }), rec({ mode: 'Sea LCL', j: 5, c: 40, d: 1 }),
    rec({ mode: 'Air', j: 4, c: 8, d: 1 }), rec({ mode: 'Road GCC', j: 4, c: 20, d: 1 }),
  ]);
  const c = compareModes(valid);
  assert.equal(c.byMode.Sea.n, 2); assert.equal(c.byMode.Sea.avg, 51); assert.equal(c.byMode.Air.avg, 13);
  assert.equal(c.byMode.Sea.bottleneck.stage, 'carrierBooking'); assert.equal(c.byMode.Sea.bottleneck.flagged, true);
  assert.equal(c.slowestByStage.carrierBooking, 'Sea'); assert.equal(c.all.n, 4);
});

t('SLA breach % counts only orders over the SLA', () => {
  const { valid } = measure([rec({ j: 5, c: 20, d: 1 }), rec({ j: 5, c: SLA_MINUTES, d: 1 })]);
  assert.equal(summarise(valid, 'All').slaBreachPct, 50);
});

t('a mode with no records yields zeros, not NaN', () => {
  const s = summarise(measure([rec({ j: 1, c: 1, d: 1 })]).valid, 'Road');
  assert.equal(s.n, 0); assert.equal(s.avg, 0); assert.equal(s.slaBreachPct, 0); assert.equal(s.bottleneck.flagged, false);
});

t('diagnose ranks stage and hold delays with measured minutes', () => {
  const rows = measure([
    rec({ mode: 'Sea FCL', j: 5, c: 60, d: 1 }), rec({ mode: 'Sea FCL', j: 5, c: 20, d: 1, holdReason: 'carrier_portal' }),
    rec({ mode: 'Air', j: 4, c: 8, d: 1 }), rec({ mode: 'Road GCC', j: 4, c: 12, d: 1 }),
  ]);
  const d = diagnose(rows.valid, 'All');
  assert.ok(d.length > 0); assert.ok(d.every((x, i) => i === 0 || d[i - 1].delayMinutes >= x.delayMinutes));
  assert.ok(d.some((x) => x.key === 'Sea:carrierBooking'));
  assert.deepEqual(diagnose(rows.valid, 'Air').filter((x) => x.scope !== 'Air'), []);
});

t('CSV escapes quotes/commas and neutralises formula injection', () => {
  const csv = toCsv(measure([rec({ customer: '=HYPERLINK("x"),evil', j: 1, c: 1, d: 1 })]).valid);
  assert.ok(csv.includes(`"'=HYPERLINK(""x""),evil"`)); assert.equal(csv.split('\r\n').length, 2);
});

t('seed data is deterministic, valid, past-dated, and differs by mode', () => {
  const a = buildVelocityRecords(NOW); const b = buildVelocityRecords(NOW);
  assert.deepEqual(a, b);
  const m = measure(a); assert.equal(m.rejected.length, 0); assert.equal(m.valid.length, a.length);
  assert.ok(m.valid.every((r) => Date.parse(r.rec.docsGeneratedAt) <= NOW));
  const c = compareModes(m.valid);
  assert.ok(c.byMode.Sea.avg > c.byMode.Road.avg && c.byMode.Road.avg > c.byMode.Air.avg, 'Sea slowest, Air fastest');
  assert.equal(c.byMode.Sea.bottleneck.stage, 'carrierBooking');
  const named = a.find((r) => r.jobNo === 'DB-1050')!;
  assert.equal(Math.round(measure([named]).valid[0].total), 75);
});

console.log(`\n${passed} checks passed`);
