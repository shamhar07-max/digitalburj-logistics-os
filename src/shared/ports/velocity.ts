/**
 * Operational Velocity: time from "Quote Accepted" to "Documents Generated", measured per order and compared by mode.
 * Pure functions — the API supplies timestamped records, and both API and web use this one implementation.
 */

export const TARGET_MINUTES = 30;
export const SLA_MINUTES = 60;

export type ModeGroup = 'Sea' | 'Air' | 'Road';
export const MODE_GROUPS: ModeGroup[] = ['Sea', 'Air', 'Road'];

/** Only hold reason we can derive from data: the customer had no TRN on file when the job was created. */
export type VelocityHoldReason = 'missing_trn';

export interface VelocityRecord {
  id: string;
  shipmentId?: string;
  jobNo: string;
  quoteNo: string;
  customer: string;
  /** production mode value: sea_fcl | sea_lcl | air | road | multimodal */
  mode: string;
  lane: string;
  acceptedAt: string;
  jobCreatedAt: string;
  carrierConfirmedAt: string;
  docsGeneratedAt: string;
  /** Downstream of document generation; shown for context, never counted in the metric. */
  customsClearedAt?: string | null;
  holdReason?: VelocityHoldReason | null;
}

export type VelocityStageKey = 'jobCreation' | 'carrierBooking' | 'docGeneration';

export const VELOCITY_STAGES: { key: VelocityStageKey; label: string; short: string; desc: string }[] = [
  { key: 'jobCreation', label: '1. Quote Accepted → Live Job Record', short: 'Job creation', desc: 'Quote acceptance to the operational job being provisioned.' },
  { key: 'carrierBooking', label: '2. Carrier Confirmation & Booking', short: 'Carrier booking', desc: 'Awaiting shipping-line confirmation, airline space or truck allocation.' },
  { key: 'docGeneration', label: '3. Document Generation (HBL / AWB / CMR, Packing List, Invoice)', short: 'Doc generation', desc: 'From booking confirmation until the full document set exists.' },
];
const STAGE_KEYS = VELOCITY_STAGES.map((s) => s.key);

/** sea_fcl / sea_lcl → Sea, air → Air, road → Road. Multimodal belongs to no single lane. */
export function modeGroup(mode: string): ModeGroup | null {
  if (mode === 'sea_fcl' || mode === 'sea_lcl' || mode === 'Sea FCL' || mode === 'Sea LCL') return 'Sea';
  if (mode === 'air' || mode === 'Air') return 'Air';
  if (mode === 'road' || mode === 'Road GCC') return 'Road';
  return null;
}

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

export interface MeasuredRecord {
  rec: VelocityRecord;
  group: ModeGroup | null;
  stages: Record<VelocityStageKey, number>;
  total: number;
  downstream?: number;
}

export interface MeasureResult {
  valid: MeasuredRecord[];
  /** Dropped because a timestamp was missing/unparseable or the sequence ran backwards. */
  rejected: { rec: VelocityRecord; reason: string }[];
}

export function measure(records: VelocityRecord[]): MeasureResult {
  const valid: MeasuredRecord[] = [];
  const rejected: MeasureResult['rejected'] = [];
  for (const rec of records) {
    const ts = [rec.acceptedAt, rec.jobCreatedAt, rec.carrierConfirmedAt, rec.docsGeneratedAt].map(Date.parse);
    if (ts.some((t) => Number.isNaN(t))) {
      rejected.push({ rec, reason: 'unparseable timestamp' });
      continue;
    }
    const stages = {
      jobCreation: minutesBetween(rec.acceptedAt, rec.jobCreatedAt),
      carrierBooking: minutesBetween(rec.jobCreatedAt, rec.carrierConfirmedAt),
      docGeneration: minutesBetween(rec.carrierConfirmedAt, rec.docsGeneratedAt),
    };
    if (Object.values(stages).some((m) => m < 0)) {
      rejected.push({ rec, reason: 'timestamps out of order' });
      continue;
    }
    const d = rec.customsClearedAt ? minutesBetween(rec.docsGeneratedAt, rec.customsClearedAt) : undefined;
    valid.push({
      rec,
      group: modeGroup(rec.mode),
      stages,
      total: stages.jobCreation + stages.carrierBooking + stages.docGeneration,
      downstream: d !== undefined && d >= 0 ? d : undefined,
    });
  }
  return { valid, rejected };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Linear-interpolated percentile of an unsorted list (p in 0..100). */
export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export interface Bottleneck {
  stage: VelocityStageKey;
  avg: number;
  /** Share of the cycle spent in this stage (0..1). */
  share: number;
  /** True when the stage dominates the cycle (≥ 40% of it and ≥ 8 minutes). */
  flagged: boolean;
}

export interface ModeSummary {
  scope: ModeGroup | 'All';
  n: number;
  avg: number;
  median: number;
  p90: number;
  slaBreachPct: number;
  stageAvg: Record<VelocityStageKey, number>;
  bottleneck: Bottleneck;
}

export function summarise(valid: MeasuredRecord[], scope: ModeGroup | 'All'): ModeSummary {
  const rows = scope === 'All' ? valid : valid.filter((r) => r.group === scope);
  const totals = rows.map((r) => r.total);
  const stageAvg = Object.fromEntries(STAGE_KEYS.map((k) => [k, mean(rows.map((r) => r.stages[k]))])) as Record<VelocityStageKey, number>;
  const avg = mean(totals);
  const top = STAGE_KEYS.reduce((best, k) => (stageAvg[k] > stageAvg[best] ? k : best), STAGE_KEYS[0]);
  const share = avg > 0 ? stageAvg[top] / avg : 0;
  return {
    scope,
    n: rows.length,
    avg,
    median: percentile(totals, 50),
    p90: percentile(totals, 90),
    slaBreachPct: rows.length ? (rows.filter((r) => r.total > SLA_MINUTES).length / rows.length) * 100 : 0,
    stageAvg,
    bottleneck: { stage: top, avg: stageAvg[top], share, flagged: rows.length > 0 && share >= 0.4 && stageAvg[top] >= 8 },
  };
}

export interface ModeComparison {
  all: ModeSummary;
  byMode: Record<ModeGroup, ModeSummary>;
  slowestByStage: Record<VelocityStageKey, ModeGroup | null>;
}

export function compareModes(valid: MeasuredRecord[]): ModeComparison {
  const byMode = Object.fromEntries(MODE_GROUPS.map((g) => [g, summarise(valid, g)])) as Record<ModeGroup, ModeSummary>;
  const slowestByStage = Object.fromEntries(
    STAGE_KEYS.map((k) => {
      const withData = MODE_GROUPS.filter((g) => byMode[g].n > 0);
      const slowest = withData.reduce<ModeGroup | null>((best, g) => (best === null || byMode[g].stageAvg[k] > byMode[best].stageAvg[k] ? g : best), null);
      return [k, slowest];
    }),
  ) as Record<VelocityStageKey, ModeGroup | null>;
  return { all: summarise(valid, 'All'), byMode, slowestByStage };
}

export interface DiagnosticRow {
  key: string;
  title: string;
  scope: ModeGroup | 'All';
  delayMinutes: number;
  basis: string;
  samples: number;
  rootCause: string;
  action: string;
}

const STAGE_CATALOG: Record<string, { title: string; rootCause: string; action: string }> = {
  'Sea:carrierBooking': { title: 'Ocean shipping-line booking confirmation', rootCause: 'Bookings requested manually on carrier portals instead of via EDI / API.', action: 'Enable direct API / EDI booking for the main liners.' },
  'Air:carrierBooking': { title: 'Airline space allocation', rootCause: 'Waiting on airline / GSA confirmation of space for each booking.', action: 'Pre-block weekly allotments and auto-confirm bookings that fall inside them.' },
  'Road:carrierBooking': { title: 'Truck & driver allocation', rootCause: 'Dispatcher assigns vehicles by hand; terminal slots are requested one at a time.', action: 'Auto-assign the nearest available vehicle and pre-book off-peak terminal slots.' },
  'any:jobCreation': { title: 'Job record provisioning', rootCause: 'Sales-to-operations hand-off waits for consignee details.', action: 'Make consignee and TRN mandatory on the accepted quote.' },
  'any:docGeneration': { title: 'Document generation', rootCause: 'Generation waits for booking details (carrier, vessel / flight, container).', action: 'Capture booking details in the confirm-booking step so documents generate immediately.' },
};

const HOLD_CATALOG: Record<VelocityHoldReason, { title: string; rootCause: string; action: string }> = {
  missing_trn: { title: 'Customer TRN missing when the job was created', rootCause: 'Operations pauses to ask the customer for a VAT number before the job can proceed.', action: 'Enforce a mandatory TRN on the customer before a quote can be sent.' },
};

/**
 * Data-driven bottleneck table. Stage rows: a mode whose average for a stage exceeds the all-mode average for that
 * stage by ≥ 3 minutes. Hold rows: orders with a recorded hold reason versus other orders of the same mode.
 */
export function diagnose(valid: MeasuredRecord[], scope: ModeGroup | 'All'): DiagnosticRow[] {
  const cmp = compareModes(valid);
  const rows: DiagnosticRow[] = [];
  const modes = scope === 'All' ? MODE_GROUPS : [scope];
  for (const g of modes) {
    if (cmp.byMode[g].n === 0) continue;
    for (const stage of STAGE_KEYS) {
      const delta = cmp.byMode[g].stageAvg[stage] - cmp.all.stageAvg[stage];
      if (delta >= 3) {
        const c = STAGE_CATALOG[`${g}:${stage}`] ?? STAGE_CATALOG[`any:${stage}`];
        rows.push({ key: `${g}:${stage}`, title: c.title, scope: g, delayMinutes: delta, basis: 'vs all-mode average for this stage', samples: cmp.byMode[g].n, rootCause: c.rootCause, action: c.action });
      }
    }
  }
  const reasons = Array.from(new Set(valid.map((r) => r.rec.holdReason).filter((x): x is VelocityHoldReason => !!x)));
  for (const reason of reasons) {
    for (const g of modes) {
      const inMode = valid.filter((r) => r.group === g);
      const held = inMode.filter((r) => r.rec.holdReason === reason);
      const clear = inMode.filter((r) => !r.rec.holdReason);
      if (!held.length || !clear.length) continue;
      const delta = mean(held.map((r) => r.total)) - mean(clear.map((r) => r.total));
      if (delta >= 3) {
        const c = HOLD_CATALOG[reason];
        rows.push({ key: `hold:${reason}:${g}`, title: c.title, scope: g, delayMinutes: delta, basis: `vs ${g} orders without a hold`, samples: held.length, rootCause: c.rootCause, action: c.action });
      }
    }
  }
  return rows.sort((a, b) => b.delayMinutes - a.delayMinutes);
}

export function fmtMinutes(m: number): string {
  if (!Number.isFinite(m)) return '—';
  return m < 10 ? m.toFixed(1) : String(Math.round(m));
}

export function slaLabel(total: number): { text: string; tone: 'fast' | 'ok' | 'breach' } {
  if (total > SLA_MINUTES) return { text: `Bottleneck delay (>${SLA_MINUTES}m)`, tone: 'breach' };
  if (total < TARGET_MINUTES) return { text: `Fast (<${TARGET_MINUTES}m)`, tone: 'fast' };
  return { text: `Within SLA (<${SLA_MINUTES}m)`, tone: 'ok' };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // neutralise spreadsheet formula injection
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows: MeasuredRecord[]): string {
  const head = ['Job', 'Quote', 'Customer', 'Mode', 'Lane', 'Quote accepted', 'Job created', 'Carrier confirmed', 'Docs generated', 'Job creation (min)', 'Carrier booking (min)', 'Doc generation (min)', 'Total (min)', 'Hold reason'];
  const lines = rows.map((r) =>
    [r.rec.jobNo, r.rec.quoteNo, r.rec.customer, r.rec.mode, r.rec.lane, r.rec.acceptedAt, r.rec.jobCreatedAt, r.rec.carrierConfirmedAt, r.rec.docsGeneratedAt,
      r.stages.jobCreation.toFixed(1), r.stages.carrierBooking.toFixed(1), r.stages.docGeneration.toFixed(1), r.total.toFixed(1), r.rec.holdReason ?? ''].map(csvCell).join(','),
  );
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}
