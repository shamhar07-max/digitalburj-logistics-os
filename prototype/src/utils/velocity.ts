import { ModeGroup, TransportMode, VelocityHoldReason, VelocityRecord } from '../types';

/** Turnaround targets used across the report and dashboard. */
export const TARGET_MINUTES = 30;
export const SLA_MINUTES = 60;

export const MODE_GROUPS: ModeGroup[] = ['Sea', 'Air', 'Road'];

export type VelocityStageKey = 'jobCreation' | 'carrierBooking' | 'docGeneration';

export const VELOCITY_STAGES: { key: VelocityStageKey; label: string; short: string; desc: string }[] = [
  {
    key: 'jobCreation',
    label: '1. Quote Accepted → Live Job Record Creation',
    short: 'Job creation',
    desc: 'Sales quote acceptance webhook and automated operational folder provisioning.',
  },
  {
    key: 'carrierBooking',
    label: '2. Carrier Confirmation & Vessel / Flight / Truck Booking',
    short: 'Carrier booking',
    desc: 'Awaiting shipping-line portal confirmation, container equipment, airline space lock or truck allocation.',
  },
  {
    key: 'docGeneration',
    label: '3. Automated Document Generator (HBL/AWB, Packing List & CI)',
    short: 'Doc generation',
    desc: 'Automated engine drafts the House Bill of Lading / AWB, Certified Packing List and Tax Invoice.',
  },
];

/** Sea FCL/LCL → Sea, Air → Air, Road GCC → Road. Rail belongs to no lane. */
export function modeGroup(mode: TransportMode): ModeGroup | null {
  if (mode === 'Sea FCL' || mode === 'Sea LCL') return 'Sea';
  if (mode === 'Air') return 'Air';
  if (mode === 'Road GCC') return 'Road';
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
  /** Records dropped because a timestamp was missing/unparseable or the sequence ran backwards. */
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
    const downstream = rec.customsValidatedAt ? minutesBetween(rec.docsGeneratedAt, rec.customsValidatedAt) : undefined;
    valid.push({
      rec,
      group: modeGroup(rec.mode),
      stages,
      total: stages.jobCreation + stages.carrierBooking + stages.docGeneration,
      downstream: downstream !== undefined && downstream >= 0 ? downstream : undefined,
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
  /** Share of the total cycle spent in this stage (0..1). */
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
  /** Share of orders that took longer than the SLA (0..100). */
  slaBreachPct: number;
  stageAvg: Record<VelocityStageKey, number>;
  bottleneck: Bottleneck;
}

const STAGE_KEYS = VELOCITY_STAGES.map((s) => s.key);

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
  /** For each stage, the mode with the highest average (only among modes that have data). */
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

// ── Diagnostics ──────────────────────────────────────────────────────────────

export interface DiagnosticRow {
  key: string;
  title: string;
  scope: ModeGroup | 'All';
  /** Extra minutes versus the benchmark (see `basis`). */
  delayMinutes: number;
  basis: string;
  samples: number;
  rootCause: string;
  action: string;
}

const STAGE_CATALOG: Record<string, { title: string; rootCause: string; action: string }> = {
  'Sea:carrierBooking': {
    title: 'Ocean shipping-line booking confirmation',
    rootCause: 'Manual booking requests on carrier web portals instead of direct EDI / API.',
    action: 'Enable direct API / EDI booking integration for the main liners (e.g. Maersk, CMA CGM).',
  },
  'Air:carrierBooking': {
    title: 'Airline space allocation lock',
    rootCause: 'Waiting on GSA / airline confirmation of space for each booking.',
    action: 'Pre-block weekly allotments and auto-confirm bookings that fall inside them.',
  },
  'Road:carrierBooking': {
    title: 'Truck & driver allocation / gate pass',
    rootCause: 'Dispatcher assigns vehicles by hand; terminal e-Token slots are requested one at a time.',
    action: 'Auto-assign the nearest available vehicle and pre-book off-peak terminal slots.',
  },
  'any:jobCreation': {
    title: 'Job record provisioning',
    rootCause: 'Sales-to-operations hand-off waits for consignee details.',
    action: 'Make consignee and TRN mandatory on the accepted quote.',
  },
  'any:docGeneration': {
    title: 'Document generation',
    rootCause: 'Generator blocked on manual cargo-data corrections.',
    action: 'Validate cargo data (HS code, weights, container no.) at booking time.',
  },
};

const HOLD_CATALOG: Record<VelocityHoldReason, { title: string; rootCause: string; action: string }> = {
  missing_trn: {
    title: 'Missing consignee FTA tax TRN',
    rootCause: 'Operations desk pauses generation to email the customer for the VAT number.',
    action: 'Enforce a mandatory TRN field at the initial Sales RFQ / quotation stage.',
  },
  carrier_portal: {
    title: 'Carrier portal outage / manual re-keying',
    rootCause: 'Booking had to be re-keyed after the shipping-line portal rejected or timed out.',
    action: 'Queue bookings for automatic retry and alert the desk after two failures.',
  },
  terminal_slot: {
    title: 'Port terminal gate-pass token (e-Token)',
    rootCause: 'Terminal appointment slot availability queue.',
    action: 'Auto-book night-time off-peak terminal slots (20:00–06:00).',
  },
};

const stageTitle = (scope: ModeGroup, stage: VelocityStageKey) => STAGE_CATALOG[`${scope}:${stage}`] ?? STAGE_CATALOG[`any:${stage}`];

/**
 * Data-driven bottleneck table. Two kinds of rows:
 *  - stage rows: a mode whose average for a stage exceeds the all-mode average for that stage by ≥ 3 minutes;
 *  - hold rows: orders that hit a recorded hold reason, versus other orders of the same mode.
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
        const c = stageTitle(g, stage);
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

// ── Formatting & export ──────────────────────────────────────────────────────

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
  // neutralise spreadsheet formula injection as well as quoting
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows: MeasuredRecord[]): string {
  const head = ['Job', 'Quote', 'Customer', 'Mode', 'Lane', 'Quote accepted', 'Job created', 'Carrier confirmed', 'Docs generated', 'Job creation (min)', 'Carrier booking (min)', 'Doc generation (min)', 'Total (min)', 'Hold reason'];
  const lines = rows.map((r) =>
    [
      r.rec.jobNo, r.rec.quoteNo, r.rec.customer, r.rec.mode, r.rec.lane,
      r.rec.acceptedAt, r.rec.jobCreatedAt, r.rec.carrierConfirmedAt, r.rec.docsGeneratedAt,
      r.stages.jobCreation.toFixed(1), r.stages.carrierBooking.toFixed(1), r.stages.docGeneration.toFixed(1), r.total.toFixed(1),
      r.rec.holdReason ?? '',
    ].map(csvCell).join(','),
  );
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}
