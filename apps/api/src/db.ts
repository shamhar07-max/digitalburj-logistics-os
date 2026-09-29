import pg from 'pg';
import { config } from './config';
import { logger } from './logger';

// NUMERIC -> number, DATE -> 'YYYY-MM-DD' string (avoid timezone shifts), INT8 -> number
pg.types.setTypeParser(1700, (v) => (v === null ? (null as any) : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? (null as any) : parseInt(v, 10)));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
pool.on('error', (err) => logger.error({ err }, 'pg pool error'));

export type Db = { query: (text: string, params?: any[]) => Promise<pg.QueryResult<any>> };

export const query = (text: string, params: any[] = []) => pool.query(text, params);

export async function one<T = any>(db: Db, text: string, params: any[] = []): Promise<T | null> {
  const r = await db.query(text, params);
  return (r.rows[0] as T) ?? null;
}
export async function many<T = any>(db: Db, text: string, params: any[] = []): Promise<T[]> {
  const r = await db.query(text, params);
  return r.rows as T[];
}

/** Run fn inside a transaction. `db` passed to fn must be used for every statement. */
export async function tx<T>(fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** Atomic per-tenant sequence -> formatted reference, e.g. nextRef(db,t,'shipment','DXB-') => DXB-4511 */
export async function nextRef(db: Db, tenantId: string, key: string, prefix: string, pad = 0, start = 0): Promise<string> {
  const r = await db.query(
    `INSERT INTO counters (tenant_id, key, value) VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [tenantId, key, start + 1],
  );
  const n = String(r.rows[0].value).padStart(pad, '0');
  return `${prefix}${n}`;
}
