import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db';
import { logger } from './logger';

const here = path.dirname(fileURLToPath(import.meta.url));

function migrationsDir() {
  // src/ (dev) and dist/ (built) both sit one level below apps/api
  const candidates = [path.resolve(here, '../migrations'), path.resolve(here, '../../migrations'), path.resolve(process.cwd(), 'migrations')];
  const dir = candidates.find((d) => fs.existsSync(d));
  if (!dir) throw new Error('migrations directory not found');
  return dir;
}

export async function migrate() {
  const dir = migrationsDir();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      logger.info(`migration applied: ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

// Run directly: `npm run migrate`
if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  migrate()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('migrations up to date');
      return pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
