import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { migrate } from './migrate';

/**
 * Applies pending database migrations from inside a hosted deployment (Vercel), where the build machine cannot reach
 * the database directly. Disabled unless MIGRATE_TOKEN is set; the token is required as `?key=` or a Bearer header.
 * Safe to call repeatedly: only unapplied migrations run, each in its own transaction.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const token = process.env.MIGRATE_TOKEN;
  const given = new URL(req.url || '/', 'http://x').searchParams.get('key') || String(req.headers.authorization || '').replace(/^Bearer /, '');
  const ok = !!token && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));
  res.setHeader('content-type', 'application/json');
  if (!ok) {
    res.statusCode = token ? 401 : 404;
    res.end(JSON.stringify({ error: token ? 'unauthorized' : 'disabled' }));
    return;
  }
  try {
    const applied = await migrate();
    res.end(JSON.stringify({ ok: true, applied, message: applied.length ? `Applied ${applied.join(', ')}` : 'Already up to date' }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
  }
}
