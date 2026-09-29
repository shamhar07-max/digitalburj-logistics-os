import { TransportMode, VelocityHoldReason, VelocityRecord } from '../types';

/**
 * Sample conversion history for the Operational Velocity report.
 *
 * This is the integration seam: in production these rows come from the quote-accepted webhook, the job-provisioning
 * event, the carrier-confirmation event and the document-generator event. Everything the report shows is computed from
 * these timestamps, so swapping this array for a live feed changes no UI code.
 *
 * Generation is deterministic (fixed seed) so reloads show the same figures; timestamps are anchored to "now" so the
 * audit log always reads as recent.
 */

const MIN = 60_000;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profile {
  mode: TransportMode;
  lanes: string[];
  count: number;
  job: [number, number];
  carrier: [number, number];
  doc: [number, number];
  /** [reason, probability, extra minutes range, stage it inflates] */
  holds: [VelocityHoldReason, number, [number, number], 'job' | 'carrier'][];
  customs: [number, number];
}

const PROFILES: Profile[] = [
  {
    mode: 'Sea FCL',
    lanes: ['Shenzhen → Jebel Ali', 'Jebel Ali → Mumbai', 'Jebel Ali → Hamburg', 'Ningbo → Jebel Ali', 'Jebel Ali → Karachi'],
    count: 11,
    job: [3, 7],
    carrier: [22, 46],
    doc: [0.5, 1],
    holds: [['carrier_portal', 0.22, [14, 24], 'carrier'], ['missing_trn', 0.14, [8, 15], 'job']],
    customs: [9, 16],
  },
  {
    mode: 'Sea LCL',
    lanes: ['Jebel Ali → Mombasa', 'Jebel Ali → Dar es Salaam', 'Nhava Sheva → Jebel Ali'],
    count: 5,
    job: [3, 7],
    carrier: [26, 44],
    doc: [0.5, 1],
    holds: [['carrier_portal', 0.2, [12, 20], 'carrier']],
    customs: [10, 18],
  },
  {
    mode: 'Air',
    lanes: ['DXB → FRA', 'DXB → LHR', 'DXB → JFK', 'AUH → CDG', 'DWC → BOM'],
    count: 10,
    job: [3, 6],
    carrier: [6, 15],
    doc: [0.4, 0.9],
    holds: [['missing_trn', 0.15, [6, 12], 'job']],
    customs: [6, 11],
  },
  {
    mode: 'Road GCC',
    lanes: ['JEA → Al Ain', 'Dubai → Riyadh', 'Sharjah → Muscat', 'JEA → Abu Dhabi', 'Dubai → Doha'],
    count: 12,
    job: [3, 6],
    carrier: [12, 24],
    doc: [0.5, 1],
    holds: [['terminal_slot', 0.3, [6, 12], 'carrier'], ['missing_trn', 0.12, [6, 12], 'job']],
    customs: [8, 14],
  },
];

const CUSTOMERS = ['Al Faris Trading', 'Nexa Pharma FZE', 'Emirates Steel Mumbai', 'Gulf Star Retail', 'Desert Rose Foods', 'Falcon Industrial', 'Marina Electronics', 'Oasis Building Materials'];

const iso = (ms: number) => new Date(ms).toISOString();

export function buildVelocityRecords(now: number = Date.now()): VelocityRecord[] {
  const rand = mulberry32(20260929);
  const between = ([lo, hi]: [number, number]) => lo + rand() * (hi - lo);
  const out: VelocityRecord[] = [];
  let seq = 2380;
  let job = 1056;

  for (const p of PROFILES) {
    for (let i = 0; i < p.count; i++) {
      let jobMin = between(p.job);
      let carrierMin = between(p.carrier);
      const docMin = between(p.doc);
      let hold: VelocityHoldReason | undefined;
      for (const [reason, prob, extra, stage] of p.holds) {
        if (!hold && rand() < prob) {
          hold = reason;
          if (stage === 'job') jobMin += between(extra);
          else carrierMin += between(extra);
        }
      }
      const total = jobMin + carrierMin + docMin;
      // spread over the last ~14 days; keep the whole cycle in the past
      const startAgo = (i + 1) * (14 * 24 * 60 / p.count) * (0.55 + rand() * 0.4) + total + 20;
      const accepted = now - startAgo * MIN;
      const created = accepted + jobMin * MIN;
      const confirmed = created + carrierMin * MIN;
      const docs = confirmed + docMin * MIN;
      out.push({
        id: `vel-${seq}`,
        jobNo: `DB-${job++}`,
        quoteNo: `QT-${seq++}`,
        customer: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)],
        mode: p.mode,
        lane: p.lanes[i % p.lanes.length],
        acceptedAt: iso(accepted),
        jobCreatedAt: iso(created),
        carrierConfirmedAt: iso(confirmed),
        docsGeneratedAt: iso(docs),
        customsValidatedAt: iso(docs + between(p.customs) * MIN),
        holdReason: hold,
      });
    }
  }

  // The five named jobs from the original audit log, kept as the most recent rows.
  const named: { jobNo: string; quoteNo: string; customer: string; mode: TransportMode; lane: string; agoMin: number; job: number; carrier: number; doc: number; hold?: VelocityHoldReason }[] = [
    { jobNo: 'DB-1048', quoteNo: 'QT-2370', customer: 'Al Faris Trading', mode: 'Sea FCL', lane: 'Shenzhen → Jebel Ali', agoMin: 95, job: 4.5, carrier: 39.9, doc: 0.6 },
    { jobNo: 'DB-1049', quoteNo: 'QT-2371', customer: 'Nexa Pharma FZE', mode: 'Air', lane: 'DXB → FRA', agoMin: 160, job: 4.2, carrier: 13.2, doc: 0.6 },
    { jobNo: 'DB-1052', quoteNo: 'QT-2374', customer: 'Al Faris Trading', mode: 'Road GCC', lane: 'JEA → Al Ain', agoMin: 215, job: 4.4, carrier: 21.0, doc: 0.6 },
    { jobNo: 'DB-1050', quoteNo: 'QT-2372', customer: 'Emirates Steel Mumbai', mode: 'Sea FCL', lane: 'JEA → Mumbai', agoMin: 24 * 60 + 40, job: 6.4, carrier: 68.0, doc: 0.6, hold: 'carrier_portal' },
    { jobNo: 'DB-1051', quoteNo: 'QT-2373', customer: 'Desert Rose Foods', mode: 'Sea LCL', lane: 'JEA → Mombasa', agoMin: 24 * 60 + 130, job: 5.0, carrier: 37.0, doc: 0.7 },
  ];
  for (const n of named) {
    const accepted = now - n.agoMin * MIN;
    const created = accepted + n.job * MIN;
    const confirmed = created + n.carrier * MIN;
    const docs = confirmed + n.doc * MIN;
    out.push({
      id: `vel-${n.quoteNo.toLowerCase()}`,
      jobNo: n.jobNo,
      quoteNo: n.quoteNo,
      customer: n.customer,
      mode: n.mode,
      lane: n.lane,
      acceptedAt: iso(accepted),
      jobCreatedAt: iso(created),
      carrierConfirmedAt: iso(confirmed),
      docsGeneratedAt: iso(docs),
      holdReason: n.hold,
    });
  }
  return out.sort((a, b) => Date.parse(b.acceptedAt) - Date.parse(a.acceptedAt));
}

export const VELOCITY_RECORDS: VelocityRecord[] = buildVelocityRecords();
