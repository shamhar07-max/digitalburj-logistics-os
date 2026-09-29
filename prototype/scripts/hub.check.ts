/* Run with: npm run check:hub */
import assert from 'node:assert/strict';
import { INITIAL_SHIPMENTS, INITIAL_FLEET_VEHICLES, INITIAL_FLEET_EQUIPMENT, INITIAL_ROAD_TRIPS } from '../src/data/mockData';
import { buildCapacitySeed } from '../src/data/modalCapacity';
import { buildHub, commitTone, estimateKg, estimateTeu, fmtCountdown, poolTone } from '../src/utils/modalHub';
import type { Shipment } from '../src/types';

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓', name); };
const NOW = Date.parse('2026-09-29T12:00:00Z');
const fleet = { vehicles: INITIAL_FLEET_VEHICLES, equipment: INITIAL_FLEET_EQUIPMENT, trips: INITIAL_ROAD_TRIPS };
const hub = (s: Shipment[] = INITIAL_SHIPMENTS) => buildHub(s, buildCapacitySeed(NOW), fleet, NOW);

t('cargo text parsing', () => {
  assert.equal(estimateTeu('1 × 40HC · 18,240 kg'), 2); assert.equal(estimateTeu('2 × 20GP · 44,000 kg'), 2);
  assert.ok(Math.abs(estimateTeu('4 CBM · 16 pallets') - 4 / 33) < 1e-9); assert.equal(estimateTeu('mystery'), 0);
  assert.equal(estimateKg('6 pallets · 480 kg chargeable'), 480); assert.equal(estimateKg('12,500 kg'), 12500); assert.equal(estimateKg('n/a'), 0);
});

t('tones: overbooked is risk for commitments, scarcity is risk for pools', () => {
  assert.equal(commitTone(84.9), 'ok'); assert.equal(commitTone(85), 'warn'); assert.equal(commitTone(100), 'warn'); assert.equal(commitTone(100.1), 'risk');
  assert.equal(poolTone(79), 'ok'); assert.equal(poolTone(80), 'warn'); assert.equal(poolTone(92), 'risk');
});

t('every job lands in exactly one lane (or is counted as unlaned)', () => {
  const h = hub();
  const active = INITIAL_SHIPMENTS.filter((s) => !['billing_ready', 'closed', 'delivered'].includes(s.status)).length;
  const inLanes = (['Sea', 'Air', 'Road'] as const).reduce((n, g) => n + Number(h.lanes[g].metrics[0].value), 0);
  assert.equal(inLanes + h.unlaned, active);
});

t('sea: live TEU from a job is added to its sailing; overbooked sailings raise a risk alert', () => {
  const sea = hub().lanes.Sea;
  const maersk = sea.sections[0].bars.find((b) => b.label.startsWith('MAERSK'))!;
  assert.equal(maersk.used, 96 + 2); // DB-1048: 1 × 40HC = 2 TEU
  const one = sea.sections[0].bars.find((b) => b.label.startsWith('ONE'))!;
  assert.equal(one.tone, 'risk'); assert.ok(sea.alerts.some((a) => a.tone === 'risk' && a.text.includes('Overbooked')));
});

t('sea: customs hold counts as free-time exposure with risk tone', () => {
  const m = hub().lanes.Sea.metrics.find((x) => x.label === 'Free-time exposure')!;
  assert.equal(m.tone, 'risk'); assert.ok(Number(m.value) >= 1);
});

t('air: live kg from the matching flight is added to booked uplift', () => {
  const ek = hub().lanes.Air.sections[0].bars.find((b) => b.label.startsWith('EK 047'))!;
  assert.equal(ek.used, 12650 + 480);
});

t('air: flights already past cut-off are excluded and the rest are sorted by cut-off', () => {
  const seed = buildCapacitySeed(NOW); seed.flights[0].cutoffAt = NOW - 1;
  const bars = buildHub(INITIAL_SHIPMENTS, seed, fleet, NOW).lanes.Air.sections[0].bars;
  assert.ok(!bars.some((b) => b.label.startsWith('EK 047')));
  assert.deepEqual(bars.map((b) => b.cutoffAt), [...bars.map((b) => b.cutoffAt!)].sort((a, b) => a - b));
});

t('road: utilisation = working ÷ in-service vehicles (maintenance excluded)', () => {
  const road = hub().lanes.Road;
  const inService = INITIAL_FLEET_VEHICLES.filter((v) => v.status !== 'maintenance');
  const working = inService.filter((v) => v.status === 'in_transit' || v.status === 'at_port_gate');
  assert.equal(road.headline.value, `${Math.round((working.length / inService.length) * 100)}%`);
  assert.equal(road.metrics[1].value, `${working.length} / ${inService.length}`);
});

t('road: expiry / service / fuel alerts are derived from the register and sorted worst-first', () => {
  const road = hub().lanes.Road;
  assert.ok(road.alerts.length > 0); assert.ok(road.vehicles!.length === INITIAL_FLEET_VEHICLES.length);
  const rank = { risk: 0, warn: 1, ok: 2 } as const;
  road.vehicles!.forEach((v, i, a) => { if (i) assert.ok(rank[a[i - 1].tone] <= rank[v.tone]); });
  // move "now" past a mulkiya expiry to prove the expiry rule fires
  const future = buildHub(INITIAL_SHIPMENTS, buildCapacitySeed(NOW), fleet, Date.parse('2027-12-01T00:00:00Z')).lanes.Road;
  assert.ok(future.alerts.some((a) => a.text.includes('expired') && a.tone === 'risk'));
});

t('adding a live shipment updates its lane immediately', () => {
  const extra: Shipment = { ...INITIAL_SHIPMENTS.find((s) => s.mode === 'Air')!, id: 'x1', jobNo: 'DB-9999', vesselFlight: 'EK 073 / Cargo', piecesWeight: '10 pallets · 2,000 kg chargeable' };
  const before = hub().lanes.Air; const after = hub([...INITIAL_SHIPMENTS, extra]).lanes.Air;
  assert.equal(Number(after.metrics[0].value), Number(before.metrics[0].value) + 1);
  const ek73 = after.sections[0].bars.find((b) => b.label.startsWith('EK 073'))!;
  assert.equal(ek73.used, 14200 + 2000);
});

t('rail jobs are reported as unlaned instead of silently dropped', () => {
  const rail: Shipment = { ...INITIAL_SHIPMENTS[0], id: 'r1', jobNo: 'DB-RAIL', mode: 'Rail', status: 'in_transit' };
  assert.equal(hub([...INITIAL_SHIPMENTS, rail]).unlaned, 1);
});

t('countdown formatting', () => {
  assert.equal(fmtCountdown(-5), 'Cut-off passed'); assert.equal(fmtCountdown(25 * 60_000), '25m');
  assert.equal(fmtCountdown(5.5 * 3_600_000), '5h 30m'); assert.equal(fmtCountdown(54 * 3_600_000), '2d 6h');
});

console.log(`\n${passed} checks passed`);
