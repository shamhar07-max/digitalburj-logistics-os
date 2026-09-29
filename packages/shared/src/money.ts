/** Money + UAE VAT helpers. All amounts AED unless stated. Pure functions -> unit tested. */

export const VAT_RATE = 0.05;

export type TaxCode = 'S' | 'Z' | 'E' | 'O';
export const TAX_CODES: Record<TaxCode, { label: string; rate: number }> = {
  S: { label: 'Standard rated 5%', rate: 0.05 },
  Z: { label: 'Zero rated (intl. transport / export)', rate: 0 },
  E: { label: 'Exempt', rate: 0 },
  O: { label: 'Out of scope (disbursement)', rate: 0 },
};

export const round2 = (n: number): number => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Default tax code by charge type. International freight is zero-rated under UAE VAT (Art. 45). */
export function defaultTaxCode(chargeType: string, opts: { international?: boolean } = {}): TaxCode {
  const t = (chargeType || '').toLowerCase();
  if (t === 'disbursement' || t === 'duty') return 'O';
  if (['freight', 'ocean_freight', 'air_freight', 'bl_fee', 'awb_fee', 'bunker', 'baf', 'thc_origin'].includes(t))
    return opts.international === false ? 'S' : 'Z';
  return 'S';
}

export interface LineInput {
  description?: string;
  quantity: number;
  unit_price: number;
  tax_code?: TaxCode;
}
export interface LineResult extends LineInput {
  tax_code: TaxCode;
  net: number;
  vat: number;
  total: number;
}

export function calcLine(l: LineInput): LineResult {
  const code = l.tax_code || 'S';
  const net = round2(l.quantity * l.unit_price);
  const vat = round2(net * TAX_CODES[code].rate);
  return { ...l, tax_code: code, net, vat, total: round2(net + vat) };
}

export function calcTotals(lines: LineInput[]) {
  const rows = lines.map(calcLine);
  const subtotal = round2(rows.reduce((s, r) => s + r.net, 0));
  const vat = round2(rows.reduce((s, r) => s + r.vat, 0));
  return { rows, subtotal, vat, total: round2(subtotal + vat) };
}

export function marginPct(sell: number, cost: number): number {
  if (!sell) return 0;
  return round2(((sell - cost) / sell) * 100);
}

export type AgeBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90p';
export function ageBucket(dueDate: string | Date, asOf: Date = new Date()): AgeBucket {
  const due = new Date(dueDate).getTime();
  const days = Math.floor((asOf.getTime() - due) / 86400000);
  if (days <= 0) return 'current';
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90p';
}

export function ageingSummary(rows: { due_date: string | Date; outstanding: number }[], asOf = new Date()) {
  const out: Record<AgeBucket, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
  for (const r of rows) out[ageBucket(r.due_date, asOf)] = round2(out[ageBucket(r.due_date, asOf)] + Number(r.outstanding));
  return out;
}

/** Import duty: UAE GCC common external tariff default 5% on CIF value. */
export function dutyOnCif(cif: number, rate = 0.05): number {
  return round2(cif * rate);
}

export const fmtAED = (n: number | string | null | undefined): string =>
  'AED ' + Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtCompact = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
};
