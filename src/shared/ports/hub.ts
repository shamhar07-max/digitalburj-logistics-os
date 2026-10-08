/**
 * Modal Hub: per-mode (Sea / Air / Road) capacity and asset utilisation. Pure — the API supplies rows, the web app
 * renders the result. Every figure carries a `source` so nothing looks more "live" than it is:
 *   live     computed now from job records
 *   register fleet / equipment register
 *   sample   pools and allotments entered manually until a terminal / airline / GPS feed is connected
 */
import { chargeableKg, lclTeu, teuOf } from './tools';
import { modeGroup, type ModeGroup } from './velocity';

export type Tone = 'ok' | 'warn' | 'risk';
export type Source = 'live' | 'register' | 'sample';

export interface HubShipment {
  id: string;
  number: string;
  customer?: string | null;
  mode: string;
  status: string;
  risk_level?: string | null;
  risk_reason?: string | null;
  origin?: string | null;
  destination?: string | null;
  vessel?: string | null;
  voyage?: string | null;
  container_type?: string | null;
  containers?: number | null;
  weight_kg?: number | null;
  volume_cbm?: number | null;
  free_days_end?: string | null;
}

export interface HubVehicle {
  id: string;
  plate: string;
  type?: string | null;
  status: string;
  driver_name?: string | null;
  fuel_pct?: number | null;
  salik_balance?: number | null;
  odometer_km?: number | null;
  next_service_km?: number | null;
  mulkiya_expiry?: string | null;
  insurance_expiry?: string | null;
}
export interface HubEquipment { category: string; status: string; code?: string }
export interface HubTrip { status: string }
export interface HubAllocation { id: string; mode: 'sea' | 'air'; carrier: string; vessel?: string | null; voyage: string; route?: string | null; cutoff_at: string; allocated: number; other_booked: number; unit: string }
export interface HubPool { id: string; mode: 'sea' | 'air'; kind: 'equipment' | 'yard' | 'cold_chain'; code: string; label: string; total: number; in_use: number; damaged: number; unit: string; sort?: number }

export interface HubInput {
  shipments: HubShipment[];
  vehicles: HubVehicle[];
  equipment: HubEquipment[];
  trips: HubTrip[];
  allocations: HubAllocation[];
  pools: HubPool[];
}

export interface Metric { label: string; value: string; sub?: string; tone: Tone; source: Source }
export interface Bar {
  key: string; label: string; sublabel?: string; used: number; total: number; unit: string; pct: number; tone: Tone; note?: string;
  /** Epoch ms of a cut-off to count down to. */
  cutoffAt?: number;
}
export interface Section { id: string; title: string; source: Source; bars: Bar[] }
export interface JobRow { shipment: HubShipment; attention: boolean }
export interface VehicleRow { vehicle: HubVehicle; tone: Tone; note?: string }
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
export interface HubModel { lanes: Record<ModeGroup, LaneModel>; unlaned: number }

const DONE = ['delivered', 'invoiced', 'closed', 'cancelled'];
/** Only jobs that have not departed still consume carrier space; in-transit cargo is already on board. */
const PRE_DEPARTURE = ['booked', 'confirmed'];
const awaitingSpace = (list: HubShipment[]) => list.filter((s) => PRE_DEPARTURE.includes(s.status));
const MAX_JOBS = 4;
const pct = (used: number, total: number) => (total > 0 ? (used / total) * 100 : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Commitments (slots, uplift): 100%+ is overbooked. */
export const commitTone = (p: number): Tone => (p > 100 ? 'risk' : p >= 85 ? 'warn' : 'ok');
/** Scarce pools (equipment, yard): little headroom is the risk. */
export const poolTone = (p: number): Tone => (p >= 92 ? 'risk' : p >= 80 ? 'warn' : 'ok');

const needsAttention = (s: HubShipment) => s.status === 'customs' || (!!s.risk_level && s.risk_level !== 'low');
const attentionTone = (s: HubShipment): Tone => (s.risk_level === 'high' ? 'risk' : 'warn');

function jobsFor(shipments: HubShipment[], group: ModeGroup) {
  const active = shipments.filter((s) => modeGroup(s.mode) === group && !DONE.includes(s.status));
  const rows: JobRow[] = active.map((shipment) => ({ shipment, attention: needsAttention(shipment) })).sort((a, b) => Number(b.attention) - Number(a.attention));
  return { active, rows: rows.slice(0, MAX_JOBS), hidden: Math.max(0, rows.length - MAX_JOBS) };
}

const teuOfShipment = (s: HubShipment) => (s.mode === 'sea_lcl' ? lclTeu(Number(s.volume_cbm) || 0) : (Number(s.containers) || 0) * teuOf(s.container_type));

function poolBars(pools: HubPool[]): Bar[] {
  return [...pools].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map((p) => {
    const inService = Math.max(0, p.total - p.damaged);
    const u = pct(p.in_use, inService);
    const free = inService - p.in_use;
    const isPlain = p.kind === 'equipment';
    return {
      key: p.id, label: p.label, sublabel: p.damaged ? `${p.damaged} damaged / out of service` : undefined, used: p.in_use, total: inService, unit: p.unit, pct: u, tone: poolTone(u),
      note: isPlain && free <= 5 ? `Only ${Math.max(0, free)} free` : undefined,
    };
  });
}

function seaLane(input: HubInput, now: number): LaneModel {
  const { active, rows, hidden } = jobsFor(input.shipments, 'Sea');
  const sailings = input.allocations.filter((a) => a.mode === 'sea' && Date.parse(a.cutoff_at) > now).sort((a, b) => Date.parse(a.cutoff_at) - Date.parse(b.cutoff_at));
  const liveTeu = new Map<string, number>();
  let unallocated = 0;
  for (const s of awaitingSpace(active)) {
    const sailing = sailings.find((x) => x.voyage === s.voyage && (x.vessel ?? '') === (s.vessel ?? ''));
    if (sailing) liveTeu.set(sailing.id, (liveTeu.get(sailing.id) ?? 0) + teuOfShipment(s));
    else unallocated += 1;
  }
  const slotBars: Bar[] = sailings.map((x) => {
    const live = liveTeu.get(x.id) ?? 0;
    const used = round1(Number(x.other_booked) + live);
    const total = Number(x.allocated);
    const p = pct(used, total);
    return {
      key: x.id, label: `${x.vessel ?? x.carrier} ${x.voyage}`, sublabel: `${x.carrier}${x.route ? ' · ' + x.route : ''}`, used, total, unit: 'TEU', pct: p, tone: commitTone(p),
      note: p > 100 ? `Overbooked by ${round1(used - total)} TEU — request extra space or roll cargo` : live > 0 ? `${round1(live)} TEU from your live jobs` : undefined,
      cutoffAt: Date.parse(x.cutoff_at),
    };
  });
  const allocated = slotBars.reduce((n, b) => n + b.total, 0);
  const booked = slotBars.reduce((n, b) => n + b.used, 0);
  const slotPct = pct(booked, allocated);

  const exposed = active.filter((s) => needsAttention(s));
  const alerts: LaneModel['alerts'] = [];
  for (const b of slotBars) if (b.pct > 100) alerts.push({ text: `${b.label}: ${b.note}`, tone: 'risk' });
  for (const s of exposed) alerts.push({ text: `${s.number} ${s.status === 'customs' ? 'in customs' : 'at risk'}${s.risk_reason ? ` — ${s.risk_reason}` : ''}`, tone: attentionTone(s) });
  if (unallocated) alerts.push({ text: `${unallocated} sea job${unallocated > 1 ? 's' : ''} not tied to an allocated sailing`, tone: 'warn' });

  return {
    group: 'Sea',
    headline: { label: 'Slot utilisation', value: allocated ? `${Math.round(slotPct)}%` : '—', tone: commitTone(slotPct) },
    metrics: [
      { label: 'Active sea jobs', value: String(active.length), sub: `${exposed.length} need attention`, tone: exposed.length ? 'warn' : 'ok', source: 'live' },
      { label: 'Slots booked', value: allocated ? `${Math.round(booked)} / ${Math.round(allocated)}` : '—', sub: 'TEU on open sailings', tone: commitTone(slotPct), source: 'live' },
      { label: 'Free-time exposure', value: String(exposed.length), sub: exposed.length ? 'jobs at risk' : 'none', tone: exposed.some((s) => s.risk_level === 'high') ? 'risk' : exposed.length ? 'warn' : 'ok', source: 'live' },
    ],
    sections: [
      { id: 'slots', title: 'Vessel slot allocation', source: 'live', bars: slotBars },
      { id: 'equipment', title: 'Container equipment & yard', source: 'sample', bars: poolBars(input.pools.filter((p) => p.mode === 'sea')) },
    ],
    alerts, jobs: rows, hiddenJobs: hidden,
  };
}

function airLane(input: HubInput, now: number): LaneModel {
  const { active, rows, hidden } = jobsFor(input.shipments, 'Air');
  const flights = input.allocations.filter((a) => a.mode === 'air' && Date.parse(a.cutoff_at) > now).sort((a, b) => Date.parse(a.cutoff_at) - Date.parse(b.cutoff_at));
  const liveKg = new Map<string, number>();
  let unmatched = 0;
  for (const s of awaitingSpace(active)) {
    const f = flights.find((x) => x.voyage === s.voyage);
    if (f) liveKg.set(f.id, (liveKg.get(f.id) ?? 0) + chargeableKg(Number(s.weight_kg) || 0, Number(s.volume_cbm) || 0).kg);
    else unmatched += 1;
  }
  const flightBars: Bar[] = flights.map((f) => {
    const live = liveKg.get(f.id) ?? 0;
    const used = Number(f.other_booked) + live;
    const total = Number(f.allocated);
    const p = pct(used, total);
    return {
      key: f.id, label: `${f.voyage}${f.route ? ' · ' + f.route : ''}`, sublabel: f.carrier, used, total, unit: 'kg', pct: p, tone: commitTone(p),
      note: p > 100 ? `Over allotment by ${Math.round(used - total).toLocaleString('en-US')} kg — offload or buy extra uplift` : live > 0 ? `${Math.round(live).toLocaleString('en-US')} kg from your live jobs` : undefined,
      cutoffAt: Date.parse(f.cutoff_at),
    };
  });
  const allocated = flightBars.reduce((n, b) => n + b.total, 0);
  const booked = flightBars.reduce((n, b) => n + b.used, 0);
  const lf = pct(booked, allocated);
  const attention = active.filter((s) => needsAttention(s));
  const alerts: LaneModel['alerts'] = [];
  for (const b of flightBars) if (b.pct > 100) alerts.push({ text: `${b.label}: ${b.note}`, tone: 'risk' });
  for (const s of attention) alerts.push({ text: `${s.number} ${s.status === 'customs' ? 'in customs' : 'flagged'}${s.risk_reason ? ` — ${s.risk_reason}` : ''}`, tone: attentionTone(s) });
  if (unmatched) alerts.push({ text: `${unmatched} air job${unmatched > 1 ? 's' : ''} not tied to an allotment flight`, tone: 'warn' });
  const next = flights[0];
  return {
    group: 'Air',
    headline: { label: 'Load factor', value: allocated ? `${Math.round(lf)}%` : '—', tone: commitTone(lf) },
    metrics: [
      { label: 'Active air jobs', value: String(active.length), sub: `${attention.length} need attention`, tone: attention.length ? 'warn' : 'ok', source: 'live' },
      { label: 'Uplift booked', value: allocated ? `${(booked / 1000).toFixed(1)}t / ${(allocated / 1000).toFixed(0)}t` : '—', sub: 'on open flights', tone: commitTone(lf), source: 'live' },
      { label: 'Next cut-off', value: next ? next.voyage : '—', sub: next ? next.route ?? next.carrier : 'no open flights', tone: 'ok', source: 'sample' },
    ],
    sections: [
      { id: 'uplift', title: 'Flight uplift vs allotment', source: 'live', bars: flightBars },
      { id: 'uld', title: 'ULD pool & cold chain', source: 'sample', bars: poolBars(input.pools.filter((p) => p.mode === 'air')) },
    ],
    alerts, jobs: rows, hiddenJobs: hidden,
  };
}

const SOON_MS = 60 * 24 * 3_600_000;
const WORKING = ['on_trip', 'at_gate'];

function roadLane(input: HubInput, now: number): LaneModel {
  const { active, rows, hidden } = jobsFor(input.shipments, 'Road');
  const vehicles = input.vehicles.filter((v) => v.status !== 'retired');
  const inService = vehicles.filter((v) => v.status !== 'maintenance');
  const working = inService.filter((v) => WORKING.includes(v.status));
  const util = pct(working.length, inService.length);

  const alerts: LaneModel['alerts'] = [];
  const vehicleRows: VehicleRow[] = vehicles.map((v) => {
    const issues: string[] = [];
    let tone: Tone = 'ok';
    const bump = (t: Tone) => { if (t === 'risk' || (t === 'warn' && tone === 'ok')) tone = t; };
    for (const [label, date] of [['Mulkiya', v.mulkiya_expiry], ['Insurance', v.insurance_expiry]] as const) {
      if (!date) continue;
      const ms = Date.parse(date) - now;
      if (Number.isNaN(ms)) continue;
      const d = String(date).slice(0, 10);
      if (ms < 0) { issues.push(`${label} expired ${d}`); bump('risk'); } else if (ms <= SOON_MS) { issues.push(`${label} due ${d}`); bump('warn'); }
    }
    if (v.fuel_pct != null && v.fuel_pct < 30) { issues.push(`fuel ${v.fuel_pct}%`); bump('warn'); }
    if (v.salik_balance != null && Number(v.salik_balance) < 300) { issues.push(`Salik AED ${Number(v.salik_balance)}`); bump('warn'); }
    if (v.next_service_km != null && v.odometer_km != null) {
      const left = v.next_service_km - v.odometer_km;
      if (left <= 5000) { issues.push(left <= 0 ? 'service overdue' : `service in ${left.toLocaleString('en-US')} km`); bump(left <= 0 ? 'risk' : 'warn'); }
    }
    if (v.status === 'maintenance') { issues.push('in maintenance'); bump('warn'); }
    const actionable = issues.filter((i) => i !== 'in maintenance');
    if (actionable.length) alerts.push({ text: `${v.plate}: ${actionable.join(' · ')}`, tone });
    return { vehicle: v, tone, note: issues.length ? issues.join(' · ') : undefined };
  });
  const order: Record<Tone, number> = { risk: 0, warn: 1, ok: 2 };
  vehicleRows.sort((a, b) => order[a.tone] - order[b.tone]);

  const eq = (cat: string) => input.equipment.filter((e) => e.category === cat);
  const eqBar = (key: string, label: string, list: HubEquipment[]): Bar => {
    const avail = list.filter((e) => e.status !== 'maintenance');
    const inUse = avail.filter((e) => e.status === 'attached').length;
    const p = pct(inUse, avail.length);
    return { key, label, sublabel: `${list.length - avail.length} in maintenance`, used: inUse, total: avail.length, unit: 'units', pct: p, tone: poolTone(p), note: avail.length && avail.length - inUse === 0 ? 'None free' : undefined };
  };
  const tripCount = (s: string) => input.trips.filter((t) => t.status === s).length;
  const pipeline = [
    { label: 'Unassigned', count: tripCount('unassigned') },
    { label: 'Assigned', count: tripCount('assigned') },
    { label: 'In progress', count: tripCount('in_progress') },
    { label: 'Completed', count: tripCount('completed') },
  ];
  const attention = active.filter((s) => needsAttention(s));
  for (const s of attention) alerts.push({ text: `${s.number} ${s.risk_reason ?? 'needs attention'}`, tone: attentionTone(s) });

  return {
    group: 'Road',
    headline: { label: 'Fleet utilisation', value: inService.length ? `${Math.round(util)}%` : '—', tone: inService.length && util < 40 ? 'warn' : 'ok' },
    metrics: [
      { label: 'Active road jobs', value: String(active.length), sub: `${attention.length} need attention`, tone: attention.length ? 'warn' : 'ok', source: 'live' },
      { label: 'Vehicles working', value: `${working.length} / ${inService.length}`, sub: `${inService.length - working.length} available`, tone: 'ok', source: 'register' },
      { label: 'Trips in progress', value: String(tripCount('in_progress')), sub: `${tripCount('unassigned') + tripCount('assigned')} waiting`, tone: tripCount('unassigned') > 0 ? 'warn' : 'ok', source: 'register' },
    ],
    sections: [
      { id: 'fleet', title: 'Fleet utilisation', source: 'register', bars: [{ key: 'fleet', label: 'Vehicles working', sublabel: `${vehicles.length - inService.length} in maintenance`, used: working.length, total: inService.length, unit: 'vehicles', pct: util, tone: 'ok' }] },
      { id: 'equipment', title: 'Chassis & reefer gensets', source: 'register', bars: [eqBar('chassis', 'Container chassis', eq('road_chassis')), eqBar('genset', 'Reefer gensets', eq('reefer_genset'))] },
    ],
    alerts, jobs: rows, hiddenJobs: hidden, vehicles: vehicleRows, pipeline,
  };
}

export function buildHub(input: HubInput, now: number): HubModel {
  return {
    lanes: { Sea: seaLane(input, now), Air: airLane(input, now), Road: roadLane(input, now) },
    unlaned: input.shipments.filter((s) => modeGroup(s.mode) === null && !DONE.includes(s.status)).length,
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
