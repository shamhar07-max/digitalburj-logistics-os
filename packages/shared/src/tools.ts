/** Freight calculators. Pure and unit-tested; factors are the standard industry ones. */
import { round2 } from './money';

/** IATA standard: 6,000 cm³ per kg → 1 CBM ≈ 166.67 kg. Courier/express: 5,000 cm³ per kg → 200 kg. */
export const VOLUMETRIC_KG_PER_CBM = { iata: 1_000_000 / 6000, courier: 1_000_000 / 5000 } as const;
export type VolumetricBasis = keyof typeof VOLUMETRIC_KG_PER_CBM;

export interface PieceDims {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  pieces: number;
}

export function cbmOf(p: PieceDims): number {
  if ([p.lengthCm, p.widthCm, p.heightCm, p.pieces].some((x) => !Number.isFinite(x) || x < 0)) return 0;
  return (p.lengthCm * p.widthCm * p.heightCm * p.pieces) / 1_000_000;
}

export const totalCbm = (rows: PieceDims[]): number => rows.reduce((n, r) => n + cbmOf(r), 0);

export function volumetricKg(cbm: number, basis: VolumetricBasis = 'iata'): number {
  return Math.round(Math.max(0, cbm) * VOLUMETRIC_KG_PER_CBM[basis] * 10) / 10;
}

/** Air chargeable weight = the greater of gross and volumetric. */
export function chargeableKg(grossKg: number, cbm: number, basis: VolumetricBasis = 'iata'): { kg: number; basis: 'gross' | 'volumetric'; volumetricKg: number } {
  const vol = volumetricKg(cbm, basis);
  const gross = Math.max(0, grossKg);
  return vol > gross ? { kg: vol, basis: 'volumetric', volumetricKg: vol } : { kg: gross, basis: 'gross', volumetricKg: vol };
}

/** TEU of a container type string such as 20GP, 40HC, 40'RF, 45HC. Unknown types count as 0 so they are never guessed. */
export function teuOf(containerType?: string | null): number {
  const m = String(containerType ?? '').match(/(20|40|45)/);
  if (!m) return 0;
  return m[1] === '20' ? 1 : 2;
}

/** 1 TEU ≈ 33 CBM of usable LCL volume. */
export const lclTeu = (cbm: number): number => (cbm > 0 ? cbm / 33 : 0);

export interface DemurrageTariff {
  /** AED per container per day after free time. */
  perDay: Record<string, number>;
}
/** Illustrative tariff only — real lines publish their own, often stepped, rates. */
export const ILLUSTRATIVE_DEMURRAGE: DemurrageTariff = { perDay: { '20': 180, '40': 320, reefer: 550 } };

export function demurrageAed(kind: '20' | '40' | 'reefer', daysOver: number, containers = 1, tariff: DemurrageTariff = ILLUSTRATIVE_DEMURRAGE): number {
  const days = Math.max(0, Math.floor(daysOver));
  return round2(days * (tariff.perDay[kind] ?? 0) * Math.max(0, containers));
}

/** Whole days beyond free time, given the free-time end and today (both ISO). Negative → 0. */
export function daysOverFreeTime(freeEndIso: string, asOf: Date = new Date()): number {
  const end = Date.parse(freeEndIso);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((asOf.getTime() - end) / 86_400_000));
}

/** UAE import: customs duty on CIF, then 5% VAT on (CIF + duty). */
export function importCosts(cif: number, dutyRate = 0.05, vatRate = 0.05) {
  const c = Math.max(0, cif);
  const duty = round2(c * dutyRate);
  const vat = round2((c + duty) * vatRate);
  return { cif: round2(c), duty, vat, total: round2(duty + vat) };
}

/** "1x40HC", "2 × 20GP", "3 x 40'RF" → { containers, container_type }. Anything else → null (never guessed). */
export function parseContainerSpec(text?: string | null): { containers: number; container_type: string } | null {
  const m = String(text ?? '').match(/(\d{1,3})\s*[x×]\s*(20|40|45)\s*'?\s*([A-Za-z]{0,3})/i);
  if (!m) return null;
  return { containers: Number(m[1]), container_type: `${m[2]}${m[3].toUpperCase()}` };
}
