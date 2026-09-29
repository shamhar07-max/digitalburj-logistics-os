import type { IncomingMessage, ServerResponse } from 'node:http';
import { runSweepOnce } from './services/scheduler';

/** Vercel Cron target. Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is rejected. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.end('unauthorized');
    return;
  }
  try {
    await runSweepOnce();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
  }
}
