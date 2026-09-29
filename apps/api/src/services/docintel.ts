import { config } from '../config';
import { logger } from '../logger';

export type DocKind = 'BL' | 'AWB' | 'INVOICE' | 'PACKING' | 'CUSTOMS';
export const DOC_KINDS: DocKind[] = ['BL', 'AWB', 'INVOICE', 'PACKING', 'CUSTOMS'];

export interface Extraction {
  fields: Record<string, any>;
  confidence: number; // 0..1 (share of expected fields found)
  engine: 'claude' | 'rules';
  warnings: string[];
}

const EXPECTED: Record<DocKind, string[]> = {
  BL: ['bl_number', 'shipper', 'consignee', 'vessel', 'voyage', 'port_of_loading', 'port_of_discharge', 'container_numbers', 'packages', 'gross_weight_kg', 'volume_cbm', 'description'],
  AWB: ['awb_number', 'shipper', 'consignee', 'origin', 'destination', 'flight', 'pieces', 'gross_weight_kg', 'chargeable_weight_kg', 'description'],
  INVOICE: ['invoice_number', 'invoice_date', 'seller', 'buyer', 'currency', 'total_amount', 'incoterm', 'country_of_origin', 'hs_codes'],
  PACKING: ['packages', 'gross_weight_kg', 'net_weight_kg', 'volume_cbm', 'description'],
  CUSTOMS: ['declaration_number', 'hs_code', 'country_of_origin', 'cif_value', 'duty_amount'],
};

/** ISO 6346 container number check-digit validation. */
export function isValidContainerNo(no: string): boolean {
  const s = no.toUpperCase().replace(/\s|-/g, '');
  if (!/^[A-Z]{4}\d{7}$/.test(s)) return false;
  // Letter values skip multiples of 11: A=10, B=12, ... K=21, L=23 ... Z=38
  const table: Record<string, number> = {};
  let val = 10;
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (val % 11 === 0) val++;
    table[c] = val++;
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = s[i];
    const v = i < 4 ? table[ch] : Number(ch);
    sum += v * 2 ** i;
  }
  const check = (sum % 11) % 10;
  return check === Number(s[10]);
}

const num = (s?: string | null) => (s ? Number(String(s).replace(/,/g, '')) : undefined);
const first = (text: string, ...res: RegExp[]) => {
  for (const r of res) {
    const m = r.exec(text);
    if (m && m[1]) return m[1].trim().replace(/\s{2,}/g, ' ');
  }
  return undefined;
};
const nextLine = (text: string, label: RegExp) => {
  const m = new RegExp(label.source + '[^\\n]*\\n\\s*([^\\n]{3,120})', label.flags).exec(text);
  return m?.[1]?.trim();
};

/** Deterministic rules-based extraction — used when no LLM key is configured or as fallback. */
export function extractWithRules(kind: DocKind, text: string): Extraction {
  const t = text.replace(/\r/g, '');
  const f: Record<string, any> = {};
  const warnings: string[] = [];
  const containers = [...new Set((t.match(/\b[A-Z]{4}\s?\d{7}\b/g) || []).map((c) => c.replace(/\s/g, '')))];
  const weight = (label: string) => num(first(t, new RegExp(`${label}[^\\d\\n]{0,20}([\\d,]+(?:\\.\\d+)?)\\s*(?:kgs?|kilo)`, 'i')));

  if (kind === 'BL') {
    f.bl_number = first(t, /B\/?L\s*(?:No\.?|Number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{5,})/i, /Bill of Lading\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{5,})/i);
    f.shipper = first(t, /Shipper\s*[:\-]\s*([^\n]{3,120})/i) || nextLine(t, /^\s*Shipper\b/im);
    f.consignee = first(t, /Consignee\s*[:\-]\s*([^\n]{3,120})/i) || nextLine(t, /^\s*Consignee\b/im);
    f.notify_party = first(t, /Notify(?: Party)?\s*[:\-]\s*([^\n]{3,120})/i);
    f.vessel = first(t, /Vessel(?:\s*\/\s*Voyage)?\s*[:\-]\s*([A-Z][A-Z0-9 .\-]{2,40}?)(?:\s+V\.?\s*\d|\s*\/|\n|$)/i);
    f.voyage = first(t, /Voy(?:age)?\.?\s*(?:No\.?)?\s*[:\-]?\s*([A-Z0-9]{3,10})/i);
    f.port_of_loading = first(t, /Port of Loading\s*[:\-]\s*([^\n]{2,60})/i);
    f.port_of_discharge = first(t, /Port of Discharge\s*[:\-]\s*([^\n]{2,60})/i);
    // B/L numbers (e.g. MEDU7771234) look exactly like container numbers: drop it, then rank ISO 6346-valid numbers first
    f.container_numbers = containers.filter((c) => c !== String(f.bl_number || '').replace(/\s/g, '')).sort((a, b) => Number(isValidContainerNo(b)) - Number(isValidContainerNo(a)));
    f.packages = num(first(t, /(?:No\.? of )?(?:Packages|Pkgs|Cartons|Pieces)\s*[:\-]?\s*([\d,]+)/i));
    f.gross_weight_kg = weight('Gross\\s*Weight');
    f.volume_cbm = num(first(t, /(?:Measurement|Volume)\s*[:\-]?\s*([\d.]+)\s*(?:CBM|M3)/i));
    f.description = first(t, /(?:Description of Goods|Cargo Description|Said to contain)\s*[:\-]\s*([^\n]{3,200})/i);
    f.freight_terms = first(t, /Freight\s*(Prepaid|Collect)/i);
    for (const c of f.container_numbers as string[]) if (!isValidContainerNo(c)) warnings.push(`Container ${c} fails ISO 6346 check-digit validation — verify the number`);
  } else if (kind === 'AWB') {
    f.awb_number = first(t, /\b(\d{3}[\s-]?\d{8})\b/);
    f.shipper = first(t, /Shipper(?:'s Name)?\s*[:\-]\s*([^\n]{3,120})/i);
    f.consignee = first(t, /Consignee(?:'s Name)?\s*[:\-]\s*([^\n]{3,120})/i);
    f.origin = first(t, /(?:Airport of Departure|Origin)\s*[:\-]\s*([A-Za-z ,]{3,40})/i);
    f.destination = first(t, /(?:Airport of Destination|Destination)\s*[:\-]\s*([A-Za-z ,]{3,40})/i);
    f.flight = first(t, /Flight(?:\s*No\.?)?\s*[:\-]?\s*([A-Z0-9]{2}\s?\d{2,4})/i);
    f.pieces = num(first(t, /(?:No\. of )?Pieces\s*[:\-]?\s*([\d,]+)/i));
    f.gross_weight_kg = weight('Gross\\s*Weight');
    f.chargeable_weight_kg = weight('Chargeable\\s*Weight');
    f.description = first(t, /(?:Nature and Quantity of Goods|Description)\s*[:\-]\s*([^\n]{3,200})/i);
  } else if (kind === 'INVOICE') {
    f.invoice_number = first(t, /Invoice\s*(?:No\.?|Number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i);
    f.invoice_date = first(t, /(?:Invoice\s*)?Date\s*[:\-]?\s*(\d{1,4}[\-/.]\d{1,2}[\-/.]\d{1,4})/i);
    f.seller = first(t, /(?:Seller|Exporter|From)\s*[:\-]\s*([^\n]{3,120})/i);
    f.buyer = first(t, /(?:Buyer|Consignee|Bill To|To)\s*[:\-]\s*([^\n]{3,120})/i);
    f.currency = first(t, /\b(AED|USD|EUR|GBP|CNY|INR|SAR)\b/);
    f.total_amount = num(first(t, /(?:Grand\s*)?Total(?:\s*Amount)?\s*(?:\(?[A-Z]{3}\)?)?\s*[:\-]?\s*(?:[A-Z]{3}\s*)?([\d,]+(?:\.\d{1,2})?)/i));
    f.incoterm = first(t, /\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/);
    f.country_of_origin = first(t, /Country of Origin\s*[:\-]\s*([A-Za-z ]{2,40})/i);
    f.hs_codes = [...new Set((t.match(/\b\d{4}\.\d{2}(?:\.\d{2,4})?\b|\bHS\s*(?:Code)?\s*[:\-]?\s*(\d{6,10})\b/gi) || []).map((s) => s.replace(/HS\s*(?:Code)?\s*[:\-]?\s*/i, '')))];
  } else if (kind === 'PACKING') {
    f.packages = num(first(t, /(?:Total\s*)?(?:Packages|Cartons|Pkgs)\s*[:\-]?\s*([\d,]+)/i));
    f.gross_weight_kg = weight('Gross\\s*W(?:eigh)?t');
    f.net_weight_kg = weight('Net\\s*W(?:eigh)?t');
    f.volume_cbm = num(first(t, /(?:Volume|CBM|Measurement)\s*[:\-]?\s*([\d.]+)/i));
    f.description = first(t, /(?:Description|Goods)\s*[:\-]\s*([^\n]{3,200})/i);
  } else if (kind === 'CUSTOMS') {
    f.declaration_number = first(t, /(?:Declaration|Bill of Entry|BOE)\s*(?:No\.?|Number)?\s*[:\-]?\s*([0-9]{2,3}[\-/]?[0-9]{5,})/i);
    f.hs_code = first(t, /HS\s*(?:Code)?\s*[:\-]?\s*(\d{6,10})/i);
    f.country_of_origin = first(t, /Country of Origin\s*[:\-]\s*([A-Za-z ]{2,40})/i);
    f.cif_value = num(first(t, /CIF\s*(?:Value)?\s*[:\-]?\s*(?:AED\s*)?([\d,]+(?:\.\d+)?)/i));
    f.duty_amount = num(first(t, /Duty\s*(?:Amount)?\s*[:\-]?\s*(?:AED\s*)?([\d,]+(?:\.\d+)?)/i));
  }
  for (const k of Object.keys(f)) if (f[k] === undefined || (Array.isArray(f[k]) && !f[k].length) || Number.isNaN(f[k])) delete f[k];
  const expected = EXPECTED[kind];
  return { fields: f, confidence: Math.round((expected.filter((k) => f[k] !== undefined).length / expected.length) * 100) / 100, engine: 'rules', warnings };
}

/** Claude extraction (supports scanned PDFs & images). Returns null if unavailable/failed so callers fall back to rules. */
export async function extractWithClaude(kind: DocKind, input: { text?: string; base64?: string; mime?: string }): Promise<Extraction | null> {
  if (!config.ANTHROPIC_API_KEY) return null;
  const fields = EXPECTED[kind].join(', ');
  const instruction = `You extract structured data from a freight ${kind} document for a UAE logistics company. Return ONLY a JSON object with these keys when present: ${fields}. Use null for unknown values. Numbers must be numbers (weights in kg, volume in CBM). container_numbers and hs_codes are arrays of strings. Do not invent data.`;
  const content: any[] = [];
  if (input.base64 && input.mime === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.base64 } });
  else if (input.base64 && input.mime?.startsWith('image/')) content.push({ type: 'image', source: { type: 'base64', media_type: input.mime, data: input.base64 } });
  if (input.text) content.push({ type: 'text', text: `Document text:\n${input.text.slice(0, 30_000)}` });
  content.push({ type: 'text', text: instruction });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.ANTHROPIC_MODEL, max_tokens: 1500, messages: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) {
      logger.warn({ status: r.status }, 'claude extraction failed');
      return null;
    }
    const data: any = await r.json();
    const raw: string = data.content?.find((c: any) => c.type === 'text')?.text || '';
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json);
    const f: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed)) if (v !== null && v !== '' && !(Array.isArray(v) && !v.length)) f[k] = v;
    const warnings: string[] = [];
    for (const c of (f.container_numbers as string[]) || []) if (!isValidContainerNo(c)) warnings.push(`Container ${c} fails ISO 6346 check-digit validation — verify the number`);
    const expected = EXPECTED[kind];
    return { fields: f, confidence: Math.round((expected.filter((k) => f[k] !== undefined).length / expected.length) * 100) / 100, engine: 'claude', warnings };
  } catch (err) {
    logger.warn({ err }, 'claude extraction error');
    return null;
  }
}

export async function pdfText(buf: Buffer): Promise<string> {
  try {
    const mod: any = await import('pdf-parse' as string);
    const fn = mod.default || mod;
    const out = await fn(buf);
    return String(out.text || '');
  } catch {
    return '';
  }
}

export async function extractDocument(kind: DocKind, file: { buffer?: Buffer; mime?: string; text?: string }): Promise<Extraction> {
  let text = file.text || '';
  if (!text && file.buffer) {
    if (file.mime === 'application/pdf') text = await pdfText(file.buffer);
    else if (file.mime?.startsWith('text/') || file.mime === 'application/json') text = file.buffer.toString('utf8');
  }
  const b64 = file.buffer && (file.mime === 'application/pdf' || file.mime?.startsWith('image/')) ? file.buffer.toString('base64') : undefined;
  const ai = await extractWithClaude(kind, { text, base64: b64, mime: file.mime });
  if (ai && Object.keys(ai.fields).length) return ai;
  if (!text) {
    return { fields: {}, confidence: 0, engine: 'rules', warnings: ['No readable text found. Scanned documents need an AI key (ANTHROPIC_API_KEY) for OCR extraction.'] };
  }
  return extractWithRules(kind, text);
}
