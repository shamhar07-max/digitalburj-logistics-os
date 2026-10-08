/** Document sets: what the generator produces per mode, and which documents a shipment must have on file. */
import type { Mode } from './workflow';

export type GeneratedDocType = 'BL' | 'AWB' | 'CMR' | 'PACKING_LIST' | 'COMMERCIAL_INVOICE';

export const GENERATED_DOC_LABEL: Record<GeneratedDocType, string> = {
  BL: 'House Bill of Lading',
  AWB: 'House Air Waybill',
  CMR: 'CMR Consignment Note',
  PACKING_LIST: 'Packing List',
  COMMERCIAL_INVOICE: 'Commercial Invoice',
};

/** Transport document by mode; every mode also gets a Packing List and a Commercial Invoice. */
export function transportDocFor(mode: Mode | string): GeneratedDocType {
  if (mode === 'air') return 'AWB';
  if (mode === 'road') return 'CMR';
  return 'BL'; // sea_fcl, sea_lcl, multimodal
}

export function generatedSetFor(mode: Mode | string): GeneratedDocType[] {
  return [transportDocFor(mode), 'PACKING_LIST', 'COMMERCIAL_INVOICE'];
}

export interface RequirementCheck {
  type: string;
  label: string;
  present: boolean;
  /** true when at least one copy is not flagged as extracted-with-warnings. */
  ok: boolean;
}

/** Documents the file should contain for a shipment, by mode and direction (import / export unknown → import rules). */
export function requiredDocs(mode: Mode | string, direction: 'import' | 'export' = 'import'): { type: string; label: string }[] {
  const base = [
    { type: transportDocFor(mode), label: GENERATED_DOC_LABEL[transportDocFor(mode)] },
    { type: 'COMMERCIAL_INVOICE', label: 'Commercial Invoice' },
    { type: 'PACKING_LIST', label: 'Packing List' },
  ];
  const extra = direction === 'import' ? [{ type: 'CUSTOMS_DECLARATION', label: 'Customs Declaration' }, { type: 'DO', label: 'Delivery Order' }, { type: 'COO', label: 'Certificate of Origin' }] : [{ type: 'CUSTOMS_DECLARATION', label: 'Export Declaration' }];
  // road consignments do not use a delivery order
  return [...base, ...extra.filter((d) => !(mode === 'road' && d.type === 'DO'))];
}

/** Completeness of a file: percentage of required document types that are present. */
export function fileCompleteness(mode: Mode | string, have: string[], direction: 'import' | 'export' = 'import') {
  const req = requiredDocs(mode, direction);
  const set = new Set(have);
  const checks: RequirementCheck[] = req.map((r) => ({ ...r, present: set.has(r.type), ok: set.has(r.type) }));
  const pct = req.length ? Math.round((checks.filter((c) => c.present).length / req.length) * 100) : 100;
  return { pct, checks, missing: checks.filter((c) => !c.present).map((c) => c.label) };
}
