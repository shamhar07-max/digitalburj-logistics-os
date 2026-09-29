import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { seedDemo } from './seed';

/**
 * One-off demo-data loader for hosted deployments (Vercel). Disabled unless DEMO_SEED_TOKEN is set; requires that token
 * as `?key=` or `Authorization: Bearer`. Idempotent: does nothing if the "al-noor" demo tenant already exists.
 * Remove the DEMO_SEED_TOKEN env var afterwards to switch the endpoint off.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const token = process.env.DEMO_SEED_TOKEN;
  const given = new URL(req.url || '/', 'http://x').searchParams.get('key') || String(req.headers.authorization || '').replace(/^Bearer /, '');
  const ok = !!token && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));
  res.setHeader('content-type', 'application/json');
  if (!ok) {
    res.statusCode = token ? 401 : 404;
    res.end(JSON.stringify({ error: token ? 'unauthorized' : 'disabled' }));
    return;
  }
  try {
    process.env.SEED_DEMO = 'true';
    const r = await seedDemo({ skipMigrate: true });
    res.end(JSON.stringify({ ok: true, ...r, signIn: 'owner@alnoor.ae', password: 'Demo@12345!' }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
  }
}
