import { FleetEquipment, FleetVehicle, ModeGroup, RoadTripDispatch, Shipment } from '../types';
import { CapacitySeed } from '../data/modalCapacity';
import { modeGroup } from './velocity';

export type Tone = 'ok' | 'warn' | 'risk';
/**
 * Where a figure comes from — shown on every tile so nothing looks more "live" than it is.
 *  live     → computed right now from the job records passed in
 *  register → fleet / equipment register
 *  sample   → illustrative telemetry (the seam for TOS / airline / GPS feeds)
 */
export type Source = 'live' | 'register' | 'sample';

export interface Metric {
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
  source: Source;
}

export interface Bar {
  key: string;
  label: string;
  sublabel?: string;
  used: number;
  total: number;
  unit: string;
  pct: number;
  tone: Tone;
  note?: string;
  /** Epoch ms of a cut-off to count down to. */
  cutoffAt?: number;
}

export interface Section {
  id: string;
  title: string;
  source: Source;
  bars: Bar[];
}

export interface JobRow {
  shipment: Shipment;
  attention: boolean;
}

export interface VehicleRow {
  vehicle: FleetVehicle;
  tone: Tone;
  note?: string;
}

export interface LaneModel {
  group: ModeGroup;
  headline: { label: string; value: string; tone: Tone };
  metrics: Metric[];
  sections: Section[];
  alerts: { text: string; tone: Tone }[];
  jobs: JobRow[];
  hiddenJobs: number;
  vehicles?: VehicleRow[];
  pipeline?: { label: string; count: number }[];
}

export interface HubModel {
  lanes: Record<ModeGroup, LaneModel>;
  /** Live jobs whose mode has no lane (Rail). */
  unlaned: number;
}

const DONE: Shipment['status'][] = ['billing_ready', 'closed', 'delivered'];
const MAX_JOBS = 4;

const pct = (used: number, total: number) => (total > 0 ? (used / total) * 100 : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Commitments (slots, uplift): 100%+ is overbooked. */
export const commitTone = (p: number): Tone => (p > 100 ? 'risk' : p >= 85 ? 'warn' : 'ok');
/** Scarce pools (equipment, yard): little headroom is the risk. */
export const poolTone = (p: number): Tone => (p >= 92 ? 'risk' : p >= 80 ? 'warn' : 'ok');

// ── parsing helpers for the free-text cargo fields ──────────────────────────
/** "1 × 40HC · 18,240 kg" → 2 TEU; "2 × 20GP" → 2; LCL "4 CBM" → ~0.12 (1 TEU ≈ 33 CBM). */
export function estimateTeu(piecesWeight: string): number {
  const box = piecesWeight.match(/(\d+)\s*[×x]\s*(20|40)/i);
  if (box) return Number(box[1]) * (box[2] === '20' ? 1 : 2);
  const cbm = piecesWeight.match(/(\d+(?:\.\d+)?)\s*CBM/i);
  if (cbm) return Number(cbm[1]) / 33;
  return 0;
}

/** "6 pallets · 480 kg chargeable" → 480. */
export function estimateKg(piecesWeight: string): number {
  const m = piecesWeight.match(/(\d[\d,]*(?:\.\d+)?)\s*kg/i);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}

/** "MAERSK SEALAND / 419W" → { vessel, voyage }. */
function splitVessel(v?: string) {
  const [vessel = '', voyage = ''] = (v ?? '').split('/').map((s) => s.trim());
  return { vessel, voyage };
}

const needsAttention = (s: Shipment) => s.status === 'customs_hold' || s.health === 'risk' || s.health === 'warn';

function jobsFor(shipments: Shipment[], group: ModeGroup) {
  const active = shipments.filter((s) => modeGroup(s.mode) === group && !DONE.includes(s.status));
  const rows: JobRow[] = active
    .map((shipment) => ({ shipment, attention: needsAttention(shipment) }))
    .sort((a, b) => Number(b.attention) - Number(a.attention));
  return { active, rows: rows.slice(0, MAX_JOBS), hidden: Math.max(0, rows.length - MAX_JOBS) };
}

// ── lanes ────────────────────────────────────────────────────────────────────
function seaLane(shipments: Shipment[], seed: CapacitySeed, now: number): LaneModel {
  const { active, rows, hidden } = jobsFor(shipments, 'Sea');
  const teuByVoyage = new Map<string, number>();
  let unallocated = 0;
  for (const s of active) {
    const { vessel, voyage } = splitVessel(s.vesselFlight);
    const sailing = seed.sailings.find((x) => x.vessel === vessel && x.voyage === voyage);
    const teu = estimateTeu(s.piecesWeight);
    if (sailing) teuByVoyage.set(sailing.id, (teuByVoyage.get(sailing.id) ?? 0) + teu);
    else unallocated += 1;
  }

  const open = seed.sailings.filter((x) => x.cutoffAt > now);
  const slotBars: Bar[] = open.map((x) => {
    const live = teuByVoyage.get(x.id) ?? 0;
    const used = round1(x.otherBookedTeu + live);
    const p = pct(used, x.allocatedTeu);
    return {
      key: x.id,
      label: `${x.vessel} ${x.voyage}`,
      sublabel: `${x.carrier} · ${x.route}`,
      used,
      total: x.allocatedTeu,
      unit: 'TEU',
      pct: p,
      tone: commitTone(p),
      note: p > 100 ? `Overbooked by ${round1(used - x.allocatedTeu)} TEU — request extra space or roll cargo` : live > 0 ? `${round1(live)} TEU from your live jobs` : undefined,
      cutoffAt: x.cutoffAt,
    };
  });
  const allocated = open.reduce((n, x) => n + x.allocatedTeu, 0);
  const booked = slotBars.reduce((n, b) => n + b.used, 0);
  const slotPct = pct(booked, allocated);

  const poolBars: Bar[] = seed.containerPools.map((p) => {
    const inService = p.total - p.damaged;
    const u = pct(p.inUse, inService);
    return { key: p.code, label: p.label, sublabel: `${p.damaged} damaged / out of service`, used: p.inUse, total: inService, unit: 'units', pct: u, tone: poolTone(u), note: inService - p.inUse <= 5 ? `Only ${inService - p.inUse} free` : undefined };
  });
  const yardP = pct(seed.yard.occupiedTeu, seed.yard.capacityTeu);
  poolBars.push({ key: 'yard', label: seed.yard.name, sublabel: 'Empty + laden stack', used: seed.yard.occupiedTeu, total: seed.yard.capacityTeu, unit: 'TEU', pct: yardP, tone: poolTone(yardP) });

  const exposed = active.filter(needsAttention);
  const alerts: LaneModel['alerts'] = [];
  for (const b of slotBars) if (b.pct > 100) alerts.push({ text: `${b.label}: ${b.note}`, tone: 'risk' });
  for (const s of exposed) alerts.push({ text: `${s.jobNo} ${s.status === 'customs_hold' ? 'on customs hold' : 'at risk'} — free time: ${s.freeTimeEnds}`, tone: s.health === 'risk' || s.status === 'customs_hold' ? 'risk' : 'warn' });
  if (unallocated) alerts.push({ text: `${unallocated} sea job${unallocated > 1 ? 's' : ''} not tied to an allocated sailing`, tone: 'warn' });

  return {
    group: 'Sea',
    headline: { label: 'Slot utilisation', value: `${Math.round(slotPct)}%`, tone: commitTone(slotPct) },
    metrics: [
      { label: 'Active sea jobs', value: String(active.length), sub: `${exposed.length} need attention`, tone: exposed.length ? 'warn' : 'ok', source: 'live' },
      { label: 'Slots booked', value: `${Math.round(booked)} / ${allocated}`, sub: 'TEU on open sailings', tone: commitTone(slotPct), source: 'live' },
      { label: 'Free-time exposure', value: String(exposed.length), sub: exposed.length ? 'jobs on hold / at risk' : 'none', tone: exposed.some((s) => s.status === 'customs_hold') ? 'risk' : exposed.length ? 'warn' : 'ok', source: 'live' },
    ],
    sections: [
      { id: 'slots', title: 'Vessel slot allocation', source: 'live', bars: slotBars },
      { id: 'equipment', title: 'Container equipment & yard', source: 'sample', bars: poolBars },
    ],
    alerts,
    jobs: rows,
    hiddenJobs: hidden,
  };
}

function airLane(shipments: Shipment[], seed: CapacitySeed, now: number): LaneModel {
  const { active, rows, hidden } = jobsFor(shipments, 'Air');
  const kgByFlight = new Map<string, number>();
  let unmatched = 0;
  for (const s of active) {
    const flight = seed.flights.find((f) => (s.vesselFlight ?? '').startsWith(f.flight));
    if (flight) kgByFlight.set(flight.id, (kgByFlight.get(flight.id) ?? 0) + estimateKg(s.piecesWeight));
    else unmatched += 1;
  }

  const open = seed.flights.filter((f) => f.cutoffAt > now).sort((a, b) => a.cutoffAt - b.cutoffAt);
  const flightBars: Bar[] = open.map((f) => {
    const live = kgByFlight.get(f.id) ?? 0;
    const used = f.otherBookedKg + live;
    const p = pct(used, f.allocatedKg);
    return {
      key: f.id,
      label: `${f.flight} · ${f.route}`,
      sublabel: f.aircraft,
      used,
      total: f.allocatedKg,
      unit: 'kg',
      pct: p,
      tone: commitTone(p),
      note: p > 100 ? `Over allotment by ${Math.round(used - f.allocatedKg).toLocaleString()} kg — offload or buy extra uplift` : live > 0 ? `${live.toLocaleString()} kg from your live jobs` : undefined,
      cutoffAt: f.cutoffAt,
    };
  });
  const allocated = open.reduce((n, f) => n + f.allocatedKg, 0);
  const booked = flightBars.reduce((n, b) => n + b.used, 0);
  const lf = pct(booked, allocated);

  const uldBars: Bar[] = seed.uldPools.map((p) => {
    const inService = p.total - p.damaged;
    const u = pct(p.inUse, inService);
    return { key: p.code, label: p.label, sublabel: p.damaged ? `${p.damaged} damaged` : undefined, used: p.inUse, total: inService, unit: 'units', pct: u, tone: poolTone(u), note: inService - p.inUse <= 5 ? `Only ${inService - p.inUse} free` : undefined };
  });
  const cp = pct(seed.coldChain.used, seed.coldChain.total);
  uldBars.push({ key: 'cold', label: seed.coldChain.label, sublabel: 'Pharma / perishables', used: seed.coldChain.used, total: seed.coldChain.total, unit: 'positions', pct: cp, tone: poolTone(cp) });

  const attention = active.filter(needsAttention);
  const alerts: LaneModel['alerts'] = [];
  for (const b of flightBars) if (b.pct > 100) alerts.push({ text: `${b.label}: ${b.note}`, tone: 'risk' });
  for (const s of attention) alerts.push({ text: `${s.jobNo} ${s.status === 'customs_hold' ? 'on customs hold' : 'flagged'}${s.exceptionNotice ? ` — ${s.exceptionNotice}` : ''}`, tone: s.health === 'risk' ? 'risk' : 'warn' });
  if (unmatched) alerts.push({ text: `${unmatched} air job${unmatched > 1 ? 's' : ''} not tied to an allotment flight`, tone: 'warn' });

  const next = open[0];
  return {
    group: 'Air',
    headline: { label: 'Load factor', value: `${Math.round(lf)}%`, tone: commitTone(lf) },
    metrics: [
      { label: 'Active air jobs', value: String(active.length), sub: `${attention.length} need attention`, tone: attention.length ? 'warn' : 'ok', source: 'live' },
      { label: 'Uplift booked', value: `${(booked / 1000).toFixed(1)}t / ${(allocated / 1000).toFixed(0)}t`, sub: 'on open flights', tone: commitTone(lf), source: 'live' },
      { label: 'Next cut-off', value: next ? next.flight : '—', sub: next ? next.route : 'no open flights', tone: 'ok', source: 'sample' },
    ],
    sections: [
      { id: 'uplift', title: 'Flight uplift vs allotment', source: 'live', bars: flightBars },
      { id: 'uld', title: 'ULD pool & cold chain', source: 'sample', bars: uldBars },
    ],
    alerts,
    jobs: rows,
    hiddenJobs: hidden,
  };
}

const SOON_MS = 60 * 24 * 3_600_000;
const parseDate = (s: string) => Date.parse(s);

function roadLane(
  shipments: Shipment[],
  fleet: { vehicles: FleetVehicle[]; equipment: FleetEquipment[]; trips: RoadTripDispatch[] },
  now: number,
): LaneModel {
  const { active, rows, hidden } = jobsFor(shipments, 'Road');
  const { vehicles, equipment, trips } = fleet;

  const inService = vehicles.filter((v) => v.status !== 'maintenance');
  const working = inService.filter((v) => v.status === 'in_transit' || v.status === 'at_port_gate');
  const util = pct(working.length, inService.length);

  const alerts: LaneModel['alerts'] = [];
  const vehicleRows: VehicleRow[] = vehicles.map((v) => {
    const issues: string[] = [];
    let tone: Tone = 'ok';
    const bump = (t: Tone) => { if (t === 'risk' || (t === 'warn' && tone === 'ok')) tone = t; };
    for (const [label, date] of [['Mulkiya', v.mulkiyaExpiry], ['Insurance', v.insuranceExpiry]] as const) {
      const ms = parseDate(date) - now;
      if (Number.isNaN(ms)) continue;
      if (ms < 0) { issues.push(`${label} expired ${date}`); bump('risk'); }
      else if (ms <= SOON_MS) { issues.push(`${label} due ${date}`); bump('warn'); }
    }
    if (v.fuelLevelPercent < 30) { issues.push(`fuel ${v.fuelLevelPercent}%`); bump('warn'); }
    if (v.salikBalanceAed < 300) { issues.push(`Salik AED ${v.salikBalanceAed}`); bump('warn'); }
    const toService = v.nextServiceKm - v.odometerKm;
    if (toService <= 5000) { issues.push(toService <= 0 ? 'service overdue' : `service in ${toService.toLocaleString()} km`); bump(toService <= 0 ? 'risk' : 'warn'); }
    if (v.status === 'maintenance') { issues.push('in maintenance'); bump('warn'); }
    // one alert per vehicle, not one per issue
    const actionable = issues.filter((i) => i !== 'in maintenance');
    if (actionable.length) alerts.push({ text: `${v.plateNo}: ${actionable.join(' · ')}`, tone });
    return { vehicle: v, tone, note: issues.length ? issues.join(' · ') : undefined };
  });
  const order: Record<Tone, number> = { risk: 0, warn: 1, ok: 2 };
  vehicleRows.sort((a, b) => order[a.tone] - order[b.tone]);

  const chassis = equipment.filter((e) => e.category === 'road_chassis');
  const gensets = equipment.filter((e) => e.category === 'reefer_genset');
  const poolBar = (key: string, label: string, list: FleetEquipment[]): Bar => {
    const inUse = list.filter((e) => e.status === 'attached_to_truck').length;
    const avail = list.filter((e) => e.status !== 'maintenance').length;
    const p = pct(inUse, avail);
    return { key, label, sublabel: `${list.filter((e) => e.status === 'maintenance').length} in maintenance`, used: inUse, total: avail, unit: 'units', pct: p, tone: poolTone(p), note: avail - inUse === 0 ? 'None free' : undefined };
  };

  const stage = (s: RoadTripDispatch['tripStatus']) => trips.filter((t) => t.tripStatus === s).length;
  const pipeline = [
    { label: 'Scheduled', count: stage('scheduled') },
    { label: 'Dispatched', count: stage('dispatched') },
    { label: 'Gate-in', count: stage('gate_in_completed') },
    { label: 'Delivered', count: stage('delivered') },
    { label: 'Empty returned', count: stage('empty_returned') },
  ];
  const inProgress = stage('dispatched') + stage('gate_in_completed');
  const attention = active.filter(needsAttention);
  for (const s of attention) alerts.push({ text: `${s.jobNo} ${s.exceptionNotice ?? 'needs attention'}`, tone: s.health === 'risk' ? 'risk' : 'warn' });

  const fleetBars: Bar[] = [
    { key: 'fleet', label: 'Vehicles working', sublabel: `${vehicles.length - inService.length} in maintenance`, used: working.length, total: inService.length, unit: 'vehicles', pct: util, tone: 'ok' },
  ];

  return {
    group: 'Road',
    headline: { label: 'Fleet utilisation', value: `${Math.round(util)}%`, tone: util < 40 ? 'warn' : 'ok' },
    metrics: [
      { label: 'Active road jobs', value: String(active.length), sub: `${attention.length} need attention`, tone: attention.length ? 'warn' : 'ok', source: 'live' },
      { label: 'Vehicles working', value: `${working.length} / ${inService.length}`, sub: `${inService.length - working.length} available`, tone: 'ok', source: 'register' },
      { label: 'Trips in progress', value: String(inProgress), sub: `${stage('scheduled')} scheduled`, tone: 'ok', source: 'register' },
    ],
    sections: [
      { id: 'fleet', title: 'Fleet utilisation', source: 'register', bars: fleetBars },
      { id: 'equipment', title: 'Chassis & reefer gensets', source: 'register', bars: [poolBar('chassis', 'Container chassis', chassis), poolBar('genset', 'Reefer gensets', gensets)] },
    ],
    alerts,
    jobs: rows,
    hiddenJobs: hidden,
    vehicles: vehicleRows,
    pipeline,
  };
}

export function buildHub(
  shipments: Shipment[],
  seed: CapacitySeed,
  fleet: { vehicles: FleetVehicle[]; equipment: FleetEquipment[]; trips: RoadTripDispatch[] },
  now: number,
): HubModel {
  return {
    lanes: { Sea: seaLane(shipments, seed, now), Air: airLane(shipments, seed, now), Road: roadLane(shipments, fleet, now) },
    unlaned: shipments.filter((s) => modeGroup(s.mode) === null && !DONE.includes(s.status)).length,
  };
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'Cut-off passed';
  const mins = Math.floor(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}
