import { round2 } from '@digitalburj/shared';

/** UAE WPS "SIF" (Salary Information File) generator. Pure & unit-tested. Always validate against your bank's current spec before first submission. */
export interface SifEmployee {
  name: string;
  person_id?: string | null; // MOHRE 14-digit person code
  routing_code?: string | null; // 9-digit bank routing code
  iban?: string | null;
  days: number;
  fixed: number;
  variable: number;
  leave_days: number;
}
export interface SifEmployer {
  establishment_id: string; // MOHRE establishment ID (13 digits)
  routing_code: string; // employer bank routing code (9 digits)
}

export function validateSif(employer: Partial<SifEmployer>, rows: SifEmployee[]): string[] {
  const errs: string[] = [];
  if (!employer.establishment_id || !/^\d{13}$/.test(employer.establishment_id)) errs.push('Employer MOHRE establishment ID must be 13 digits (Settings → Payroll)');
  if (!employer.routing_code || !/^\d{9}$/.test(employer.routing_code)) errs.push('Employer bank routing code must be 9 digits (Settings → Payroll)');
  for (const r of rows) {
    if (!r.person_id || !/^\d{14}$/.test(r.person_id)) errs.push(`${r.name}: person ID must be 14 digits`);
    if (!r.routing_code || !/^\d{9}$/.test(r.routing_code)) errs.push(`${r.name}: bank routing code must be 9 digits`);
    if (!r.iban || !/^AE\d{21}$/.test(r.iban.replace(/\s+/g, ''))) errs.push(`${r.name}: IBAN must be a valid 23-character UAE IBAN`);
  }
  return errs;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function buildSif(employer: SifEmployer, period: string, rows: SifEmployee[], now = new Date()) {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const lines = rows.map((r) =>
    ['EDR', r.person_id, r.routing_code, (r.iban || '').replace(/\s+/g, ''), ymd(start), ymd(end), r.days, r.fixed.toFixed(2), r.variable.toFixed(2), r.leave_days].join(','),
  );
  const total = round2(rows.reduce((s, r) => s + r.fixed + r.variable, 0));
  lines.push(['SCR', employer.establishment_id, employer.routing_code, ymd(now), `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`, `${pad(m)}${y}`, rows.length, total.toFixed(2), 'AED', ''].join(','));
  const filename = `${employer.establishment_id}${String(y).slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}.SIF`;
  return { filename, content: lines.join('\r\n') + '\r\n', total };
}

/** Days in month helper + unpaid-leave deduction (30-day basis, as commonly used in UAE payroll). */
export const dailyRate = (monthlyGross: number) => round2(monthlyGross / 30);
export function overlapDays(fromDate: string, toDate: string, period: string): number {
  const [y, m] = period.split('-').map(Number);
  const pStart = Date.UTC(y, m - 1, 1);
  const pEnd = Date.UTC(y, m, 0);
  const s = Math.max(Date.parse(fromDate), pStart);
  const e = Math.min(Date.parse(toDate), pEnd);
  return e < s ? 0 : Math.round((e - s) / 86_400_000) + 1;
}
