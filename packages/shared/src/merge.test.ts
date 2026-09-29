import { describe, expect, it } from 'vitest';
import {
  SLA_MINUTES, buildHub, cbmOf, chargeableKg, commitTone, compareModes, daysOverFreeTime, demurrageAed, diagnose, fileCompleteness, fmtCountdown, generatedSetFor, importCosts, lclTeu, measure,
  modeGroup, parseContainerSpec, percentile, poolTone, requiredDocs, summarise, teuOf, toCsv, totalCbm, transportDocFor, volumetricKg,
  type HubInput, type HubShipment, type VelocityRecord,
} from './index';

// ── velocity ────────────────────────────────────────────────────────────────
const NOW = Date.parse('2026-09-29T12:00:00Z');
const at = (min: number) => new Date(NOW + min * 60_000).toISOString();
const rec = (o: Partial<VelocityRecord> & { j: number; c: number; d: number }): VelocityRecord => ({
  id: 'x', jobNo: 'J', quoteNo: 'Q', customer: 'C', mode: 'air', lane: 'A → B',
  acceptedAt: at(0), jobCreatedAt: at(o.j), carrierConfirmedAt: at(o.j + o.c), docsGeneratedAt: at(o.j + o.c + o.d), ...o,
});

describe('velocity', () => {
  it('maps production modes to lanes; multimodal has none', () => {
    expect(modeGroup('sea_fcl')).toBe('Sea'); expect(modeGroup('sea_lcl')).toBe('Sea'); expect(modeGroup('air')).toBe('Air'); expect(modeGroup('road')).toBe('Road'); expect(modeGroup('multimodal')).toBeNull();
  });
  it('percentile interpolates', () => {
    expect(percentile([], 50)).toBe(0); expect(percentile([10], 90)).toBe(10); expect(percentile([10, 20, 30, 40], 50)).toBe(25); expect(percentile([1, 2, 3, 4, 5], 90)).toBeCloseTo(4.6);
  });
  it('stages add up to Quote Accepted → Documents Generated', () => {
    const { valid } = measure([rec({ j: 5, c: 30, d: 1 })]);
    expect(valid[0].total).toBe(36); expect(valid[0].stages.carrierBooking).toBe(30);
  });
  it('rejects out-of-order and unparseable records instead of producing negative durations', () => {
    const r = measure([rec({ j: 5, c: 30, d: 1, carrierConfirmedAt: at(2) }), rec({ j: 5, c: 30, d: 1, docsGeneratedAt: 'nope' }), rec({ j: 1, c: 1, d: 1 })]);
    expect(r.valid).toHaveLength(1); expect(r.rejected.map((x) => x.reason)).toEqual(['timestamps out of order', 'unparseable timestamp']);
  });
  it('captures downstream customs time without counting it', () => {
    const r = measure([rec({ j: 5, c: 10, d: 1, customsClearedAt: at(28) })]).valid[0];
    expect(r.total).toBe(16); expect(r.downstream).toBe(12);
  });
  it('summarises per mode and flags the dominant stage', () => {
    const { valid } = measure([rec({ mode: 'sea_fcl', j: 5, c: 50, d: 1 }), rec({ mode: 'sea_lcl', j: 5, c: 40, d: 1 }), rec({ mode: 'air', j: 4, c: 8, d: 1 }), rec({ mode: 'road', j: 4, c: 20, d: 1 })]);
    const c = compareModes(valid);
    expect(c.byMode.Sea.n).toBe(2); expect(c.byMode.Sea.avg).toBe(51); expect(c.byMode.Air.avg).toBe(13);
    expect(c.byMode.Sea.bottleneck).toMatchObject({ stage: 'carrierBooking', flagged: true }); expect(c.slowestByStage.carrierBooking).toBe('Sea'); expect(c.all.n).toBe(4);
  });
  it('SLA breach % counts only orders over the SLA; empty mode gives zeros not NaN', () => {
    const { valid } = measure([rec({ j: 5, c: 20, d: 1 }), rec({ j: 5, c: SLA_MINUTES, d: 1 })]);
    expect(summarise(valid, 'All').slaBreachPct).toBe(50);
    const e = summarise(valid, 'Road'); expect(e).toMatchObject({ n: 0, avg: 0, slaBreachPct: 0 }); expect(e.bottleneck.flagged).toBe(false);
  });
  it('diagnose ranks stage and hold delays, scoped to the mode', () => {
    const { valid } = measure([rec({ mode: 'sea_fcl', j: 5, c: 60, d: 1 }), rec({ mode: 'sea_fcl', j: 25, c: 20, d: 1, holdReason: 'missing_trn' }), rec({ mode: 'air', j: 4, c: 8, d: 1 }), rec({ mode: 'road', j: 4, c: 12, d: 1 })]);
    const d = diagnose(valid, 'All');
    expect(d.every((x, i) => i === 0 || d[i - 1].delayMinutes >= x.delayMinutes)).toBe(true); expect(d.some((x) => x.key === 'Sea:carrierBooking')).toBe(true);
    expect(diagnose(valid, 'Air').filter((x) => x.scope !== 'Air')).toEqual([]);
  });
  it('CSV escapes and neutralises formula injection', () => {
    const csv = toCsv(measure([rec({ customer: '=HYPERLINK("x"),evil', j: 1, c: 1, d: 1 })]).valid);
    expect(csv).toContain(`"'=HYPERLINK(""x""),evil"`); expect(csv.split('\r\n')).toHaveLength(2);
  });
});

// ── calculators ─────────────────────────────────────────────────────────────
describe('tools', () => {
  it('volumetric weight uses IATA 6000 and courier 5000 divisors', () => {
    expect(volumetricKg(1)).toBe(166.7); expect(volumetricKg(1, 'courier')).toBe(200); expect(volumetricKg(-3)).toBe(0);
  });
  it('CBM from carton dimensions, ignoring invalid rows', () => {
    expect(cbmOf({ lengthCm: 100, widthCm: 50, heightCm: 40, pieces: 10 })).toBeCloseTo(2); expect(cbmOf({ lengthCm: NaN, widthCm: 1, heightCm: 1, pieces: 1 })).toBe(0);
    expect(totalCbm([{ lengthCm: 100, widthCm: 100, heightCm: 100, pieces: 1 }, { lengthCm: 50, widthCm: 50, heightCm: 100, pieces: 4 }])).toBeCloseTo(2);
  });
  it('chargeable weight is the greater of gross and volumetric', () => {
    expect(chargeableKg(100, 1)).toMatchObject({ kg: 166.7, basis: 'volumetric' }); expect(chargeableKg(480, 1)).toMatchObject({ kg: 480, basis: 'gross' });
  });
  it('TEU of container types; unknown types are not guessed', () => {
    expect(teuOf('20GP')).toBe(1); expect(teuOf("40'HC")).toBe(2); expect(teuOf('45HC')).toBe(2); expect(teuOf('mystery')).toBe(0); expect(teuOf(null)).toBe(0); expect(lclTeu(33)).toBe(1);
  });
  it('parses container specs from quote text and refuses to guess', () => {
    expect(parseContainerSpec('1x40HC')).toEqual({ containers: 1, container_type: '40HC' }); expect(parseContainerSpec('2 × 20GP')).toEqual({ containers: 2, container_type: '20GP' });
    expect(parseContainerSpec("3 x 40'rf")).toEqual({ containers: 3, container_type: '40RF' }); expect(parseContainerSpec('LCL 4 CBM')).toBeNull(); expect(parseContainerSpec(null)).toBeNull();
  });
  it('demurrage and days over free time', () => {
    expect(demurrageAed('40', 3)).toBe(960); expect(demurrageAed('reefer', 2, 2)).toBe(2200); expect(demurrageAed('20', -2)).toBe(0);
    expect(daysOverFreeTime('2026-09-25T00:00:00Z', new Date('2026-09-28T06:00:00Z'))).toBe(4); expect(daysOverFreeTime('2026-10-05T00:00:00Z', new Date('2026-09-28T00:00:00Z'))).toBe(0); expect(daysOverFreeTime('bad')).toBe(0);
  });
  it('import costs: duty on CIF then VAT on CIF + duty', () => {
    expect(importCosts(100000)).toEqual({ cif: 100000, duty: 5000, vat: 5250, total: 10250 }); expect(importCosts(-5).total).toBe(0);
  });
});

// ── document rules ──────────────────────────────────────────────────────────
describe('documents', () => {
  it('transport document follows the mode', () => {
    expect(transportDocFor('sea_fcl')).toBe('BL'); expect(transportDocFor('air')).toBe('AWB'); expect(transportDocFor('road')).toBe('CMR');
    expect(generatedSetFor('air')).toEqual(['AWB', 'PACKING_LIST', 'COMMERCIAL_INVOICE']);
  });
  it('required documents differ by mode and direction', () => {
    expect(requiredDocs('sea_fcl', 'import').map((d) => d.type)).toContain('DO'); expect(requiredDocs('road', 'import').map((d) => d.type)).not.toContain('DO');
    expect(requiredDocs('air', 'export').map((d) => d.type)).not.toContain('COO');
  });
  it('completeness lists what is missing', () => {
    const r = fileCompleteness('air', ['AWB', 'COMMERCIAL_INVOICE']);
    expect(r.pct).toBe(Math.round((2 / requiredDocs('air').length) * 100)); expect(r.missing).toContain('Packing List');
    expect(fileCompleteness('air', requiredDocs('air').map((d) => d.type)).pct).toBe(100);
  });
});

// ── hub ─────────────────────────────────────────────────────────────────────
const ship = (o: Partial<HubShipment>): HubShipment => ({ id: 's', number: 'DXB-1', mode: 'sea_fcl', status: 'confirmed', risk_level: 'low', container_type: '40HC', containers: 1, weight_kg: 1000, volume_cbm: 10, ...o });
const H = 3_600_000;
const base = (): HubInput => ({
  shipments: [
    ship({ id: 'a', number: 'DXB-1', vessel: 'MAERSK SEALAND', voyage: '419W' }),
    ship({ id: 'b', number: 'DXB-2', mode: 'air', voyage: 'EK 047', weight_kg: 480, volume_cbm: 1 }),
    ship({ id: 'c', number: 'DXB-3', mode: 'road', risk_level: 'high', risk_reason: 'Border queue' }),
    ship({ id: 'd', number: 'DXB-4', mode: 'sea_fcl', status: 'delivered' }),
  ],
  vehicles: [
    { id: 'v1', plate: 'DXB 1', status: 'on_trip', fuel_pct: 78, salik_balance: 450, odometer_km: 88450, next_service_km: 90000, mulkiya_expiry: '2026-11-15' },
    { id: 'v2', plate: 'DXB 2', status: 'available', fuel_pct: 20, salik_balance: 100, odometer_km: 1000, next_service_km: 50000, mulkiya_expiry: '2028-01-01' },
    { id: 'v3', plate: 'DXB 3', status: 'maintenance' },
  ],
  equipment: [{ category: 'road_chassis', status: 'attached' }, { category: 'road_chassis', status: 'operational' }, { category: 'reefer_genset', status: 'attached' }],
  trips: [{ status: 'in_progress' }, { status: 'assigned' }, { status: 'completed' }],
  allocations: [
    { id: 'sl1', mode: 'sea', carrier: 'Maersk', vessel: 'MAERSK SEALAND', voyage: '419W', route: 'A → B', cutoff_at: new Date(NOW + 20 * H).toISOString(), allocated: 120, other_booked: 96, unit: 'TEU' },
    { id: 'sl2', mode: 'sea', carrier: 'ONE', vessel: 'ONE COMMITMENT', voyage: '054E', cutoff_at: new Date(NOW + 70 * H).toISOString(), allocated: 80, other_booked: 84, unit: 'TEU' },
    { id: 'sl0', mode: 'sea', carrier: 'Gone', vessel: 'X', voyage: '1', cutoff_at: new Date(NOW - H).toISOString(), allocated: 10, other_booked: 1, unit: 'TEU' },
    { id: 'fl1', mode: 'air', carrier: 'Emirates', voyage: 'EK 047', route: 'DXB → FRA', cutoff_at: new Date(NOW + 6 * H).toISOString(), allocated: 18000, other_booked: 12650, unit: 'kg' },
  ],
  pools: [
    { id: 'p1', mode: 'sea', kind: 'equipment', code: '40HC', label: "40' High Cube", total: 140, in_use: 129, damaged: 5, unit: 'units' },
    { id: 'p2', mode: 'air', kind: 'cold_chain', code: 'CC', label: '2–8 °C positions', total: 24, in_use: 20, damaged: 0, unit: 'positions' },
  ],
});

describe('modal hub', () => {
  it('tones: overbooked commitments are risk; scarce pools are risk near exhaustion', () => {
    expect([commitTone(84.9), commitTone(85), commitTone(100), commitTone(100.1)]).toEqual(['ok', 'warn', 'warn', 'risk']); expect([poolTone(79), poolTone(80), poolTone(92)]).toEqual(['ok', 'warn', 'risk']);
  });
  it('every active job lands in exactly one lane or is reported as unlaned', () => {
    const inp = base(); inp.shipments.push(ship({ id: 'm', mode: 'multimodal' }));
    const h = buildHub(inp, NOW);
    expect(['Sea', 'Air', 'Road'].reduce((n, g) => n + Number(h.lanes[g as 'Sea'].metrics[0].value), 0) + h.unlaned).toBe(4); expect(h.unlaned).toBe(1);
  });
  it('sea: live TEU is added to the matching sailing; past cut-offs are excluded; overbooking alerts', () => {
    const bars = buildHub(base(), NOW).lanes.Sea.sections[0].bars;
    expect(bars.map((b) => b.key)).toEqual(['sl1', 'sl2']); expect(bars[0].used).toBe(98); expect(bars[1].tone).toBe('risk');
    expect(buildHub(base(), NOW).lanes.Sea.alerts.some((a) => a.text.includes('Overbooked'))).toBe(true);
  });
  it('cargo already in transit no longer consumes space and never raises a not-tied alert', () => {
    const inp = base(); inp.shipments.push(ship({ id: 't', number: 'DXB-8', status: 'in_transit', vessel: 'GONE', voyage: '0' }));
    const sea = buildHub(inp, NOW).lanes.Sea;
    expect(sea.alerts.some((a) => a.text.includes('not tied'))).toBe(false); expect(sea.sections[0].bars[0].used).toBe(98);
  });
  it('sea: unmatched sea jobs are flagged, not silently dropped', () => {
    const inp = base(); inp.shipments.push(ship({ id: 'z', number: 'DXB-9', vessel: 'UNKNOWN', voyage: '9' }));
    expect(buildHub(inp, NOW).lanes.Sea.alerts.some((a) => a.text.includes('not tied to an allocated sailing'))).toBe(true);
  });
  it('air: chargeable kg (gross vs volumetric) is added to the matching flight', () => {
    const bar = buildHub(base(), NOW).lanes.Air.sections[0].bars[0];
    expect(bar.used).toBe(12650 + 480); // 480 gross > 166.7 volumetric
    const inp = base(); inp.shipments[1] = ship({ id: 'b', number: 'DXB-2', mode: 'air', voyage: 'EK 047', weight_kg: 100, volume_cbm: 3 });
    expect(buildHub(inp, NOW).lanes.Air.sections[0].bars[0].used).toBe(12650 + 500); // 3 CBM → 500 kg volumetric
  });
  it('road: utilisation excludes maintenance; alerts are one line per vehicle, worst first', () => {
    const road = buildHub(base(), NOW).lanes.Road;
    expect(road.headline.value).toBe('50%'); expect(road.metrics[1].value).toBe('1 / 2');
    expect(road.alerts.filter((a) => a.text.startsWith('DXB 2')).length).toBe(1);
    const rank = { risk: 0, warn: 1, ok: 2 } as const; road.vehicles!.forEach((v, i, a) => { if (i) expect(rank[a[i - 1].tone]).toBeLessThanOrEqual(rank[v.tone]); });
  });
  it('road: an expiry in the past is a risk alert', () => {
    const road = buildHub(base(), Date.parse('2027-12-01T00:00:00Z')).lanes.Road;
    expect(road.alerts.some((a) => a.tone === 'risk' && a.text.includes('expired'))).toBe(true);
  });
  it('adding a live shipment updates its lane immediately', () => {
    const inp = base(); const before = Number(buildHub(inp, NOW).lanes.Air.metrics[0].value);
    inp.shipments.push(ship({ id: 'n', number: 'DXB-7', mode: 'air', voyage: 'EK 047', weight_kg: 2000, volume_cbm: 1 }));
    const after = buildHub(inp, NOW).lanes.Air;
    expect(Number(after.metrics[0].value)).toBe(before + 1); expect(after.sections[0].bars[0].used).toBe(12650 + 480 + 2000);
  });
  it('countdown formatting', () => {
    expect([fmtCountdown(-5), fmtCountdown(25 * 60_000), fmtCountdown(5.5 * H), fmtCountdown(54 * H)]).toEqual(['Cut-off passed', '25m', '5h 30m', '2d 6h']);
  });
});
