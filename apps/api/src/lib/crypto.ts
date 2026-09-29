import crypto from 'node:crypto';
import { config } from '../config';

const key = () => Buffer.from(config.ENCRYPTION_KEY, 'hex');

/** AES-256-GCM. Output: base64(iv | tag | ciphertext) prefixed with "enc:". */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return 'enc:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function decrypt(payload: string): string {
  if (!payload.startsWith('enc:')) return payload;
  const raw = Buffer.from(payload.slice(4), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const timingSafeEq = (a: string, b: string) => {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
export const hmacSha256 = (secret: string, body: string | Buffer) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex');

const SECRET_KEYS = /(secret|token|key|password)/i;
/** Encrypt secret-looking string values in an integration config before storing. */
export function encryptConfig(cfg: Record<string, any>, previous: Record<string, any> = {}) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(cfg || {})) {
    if (typeof v === 'string' && SECRET_KEYS.test(k)) {
      if (v === '********') out[k] = previous[k]; // untouched by UI
      else out[k] = v ? encrypt(v) : '';
    } else out[k] = v;
  }
  return out;
}
export function maskConfig(cfg: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(cfg || {})) out[k] = typeof v === 'string' && SECRET_KEYS.test(k) && v ? '********' : v;
  return out;
}
export function decryptConfig(cfg: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(cfg || {})) out[k] = typeof v === 'string' && v.startsWith('enc:') ? decrypt(v) : v;
  return out;
}
