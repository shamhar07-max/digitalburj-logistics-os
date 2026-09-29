import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config, isProd } from './config';
import { logger } from './logger';
import { query } from './db';
import { authenticate } from './auth/middleware';
import { errorMiddleware, HttpError, wrap } from './lib/errors';
import { buildResourceRouter } from './crud/router';
import { resources } from './crud/registry';
import { authRouter } from './routes/auth';
import { shipmentsRouter } from './routes/shipments';
import { quotesRouter } from './routes/quotes';
import { invoicesRouter } from './routes/invoices';
import { accountingRouter } from './routes/accounting';
import { customsRouter } from './routes/customs';
import { dispatchRouter, driverRouter } from './routes/dispatch';
import { warehouseRouter, procurementRouter, approvalsRouter, pipelineRouter } from './routes/operations';
import { peopleRouter, payrollRouter, complianceRouter } from './routes/people';
import { documentsRouter, docintelRouter } from './routes/documents';
import { inboxRouter, webhooksRouter } from './routes/inbox';
import { dashboardRouter, aiRouter, reportsRouter, searchRouter, notificationsRouter } from './routes/intel';
import { portalRouter, publicRouter } from './routes/portal';
import { adminRouter, lookupRouter } from './routes/admin';

/** Custom routers that must be mounted BEFORE the generic CRUD router on the same base path. */
const custom: Record<string, express.Router[]> = {
  shipments: [shipmentsRouter],
  invoices: [invoicesRouter],
  customs: [customsRouter],
  documents: [documentsRouter],
  'warehouse/bins': [],
};

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' } }));
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'], connectSrc: ["'self'", 'wss:', 'https:'], scriptSrc: ["'self'"], frameAncestors: ["'none'"] } }
        : false,
    }),
  );
  const origins = config.WEB_ORIGIN.split(',').map((s) => s.trim());
  app.use(cors({ origin: origins, credentials: true, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '6mb', verify: (req: any, _res, buf) => { req.rawBody = buf; } }));

  // Health
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/readyz', wrap(async (_req, res) => {
    await query('SELECT 1');
    res.json({ ok: true, version: '3.0.0' });
  }));

  // Rate limits
  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  api.use('/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: config.LOGIN_RATE_LIMIT, standardHeaders: true, legacyHeaders: false, message: { error: { message: 'Too many attempts. Try again later.' } } }));
  api.use('/auth/register', rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }));
  api.use('/auth/forgot', rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }));

  // Public
  api.use('/auth', authRouter);
  api.use('/webhooks', webhooksRouter);
  api.use('/public', publicRouter);

  // Authenticated
  api.use(authenticate);
  api.use('/dashboard', dashboardRouter);
  api.use('/ai', aiRouter);
  api.use('/reports', reportsRouter);
  api.use('/search', searchRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/portal', portalRouter);
  api.use('/admin', adminRouter);
  api.use('/lookup', lookupRouter);
  api.use('/quotes', quotesRouter);
  api.use('/accounting', accountingRouter);
  api.use('/dispatch', dispatchRouter);
  api.use('/driver', driverRouter);
  api.use('/warehouse', warehouseRouter);
  api.use('/procurement', procurementRouter);
  api.use('/approvals', approvalsRouter);
  api.use('/pipeline', pipelineRouter);
  api.use('/hr', peopleRouter);
  api.use('/payroll', payrollRouter);
  api.use('/compliance', complianceRouter);
  api.use('/docintel', docintelRouter);
  api.use('/inbox', inboxRouter);

  for (const r of resources) {
    for (const cr of custom[r.key] || []) api.use('/' + r.key, cr);
    api.use('/' + r.key, buildResourceRouter(r));
  }

  api.use((_req, _res, next) => next(new HttpError(404, 'Endpoint not found', 'not_found')));
  app.use('/api', api);

  // Serve the built SPA in production (single-container deploy)
  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDist = [path.resolve(here, '../../web/dist'), path.resolve(process.cwd(), 'apps/web/dist'), path.resolve(process.cwd(), 'web-dist')].find((p) => fs.existsSync(path.join(p, 'index.html')));
  if (webDist) {
    app.use(express.static(webDist, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api\/|ws|healthz|readyz).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorMiddleware);
  return app;
}
