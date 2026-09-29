import { HttpError } from '../lib/errors';
import type { Col } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}/;
export const isUuid = (v: any): v is string => typeof v === 'string' && UUID.test(v);

function coerce(col: Col, v: any): any {
  const empty = v === undefined || v === null || v === '';
  if (empty) {
    if (col.req) throw 'is required';
    return null;
  }
  switch (col.t) {
    case 'text': {
      if (typeof v !== 'string' && typeof v !== 'number') throw 'must be text';
      const s = String(v).trim();
      if (col.req && !s) throw 'is required';
      if (s.length > (col.max ?? 5000)) throw `must be at most ${col.max ?? 5000} characters`;
      if (col.enum && !col.enum.includes(s)) throw `must be one of: ${col.enum.join(', ')}`;
      return s;
    }
    case 'num':
    case 'int': {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) throw 'must be a number';
      if (col.t === 'int' && !Number.isInteger(n)) throw 'must be a whole number';
      if (col.min !== undefined && n < col.min) throw `must be at least ${col.min}`;
      if (col.max !== undefined && n > col.max) throw `must be at most ${col.max}`;
      return n;
    }
    case 'bool':
      if (v === true || v === 'true' || v === 1 || v === '1') return true;
      if (v === false || v === 'false' || v === 0 || v === '0') return false;
      throw 'must be true or false';
    case 'date': {
      if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(v.slice(0, 10)))) throw 'must be a date (YYYY-MM-DD)';
      return v.slice(0, 10);
    }
    case 'ts': {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw 'must be a valid date-time';
      return d.toISOString();
    }
    case 'uuid':
      if (!isUuid(v)) throw 'must be a valid id';
      return v;
    case 'json':
      return JSON.stringify(v);
    case 'textarr': {
      const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : null;
      if (!arr) throw 'must be a list';
      return arr.map((x) => String(x).trim()).filter(Boolean);
    }
  }
}

/**
 * Validate + coerce a request body against column specs.
 * partial=true (PATCH): only present keys are validated and required-ness is not enforced for absent keys.
 */
export function validateBody(cols: Col[], body: any, partial: boolean): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Body must be an object', 'bad_request');
  const out: Record<string, any> = {};
  const errors: Record<string, string[]> = {};
  for (const c of cols) {
    if (c.ro) continue;
    const present = Object.prototype.hasOwnProperty.call(body, c.n);
    if (!present) {
      if (!partial && c.req) errors[c.n] = ['is required'];
      continue;
    }
    try {
      out[c.n] = coerce(c, body[c.n]);
    } catch (m) {
      errors[c.n] = [String(m)];
    }
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', 'validation', errors);
  return out;
}
