import http from 'node:http';
import { config } from './config';
import { logger } from './logger';
import { pool } from './db';
import { migrate } from './migrate';
import { createApp } from './app';
import { startAutomation } from './services/automation';
import { attachRealtime } from './services/realtime';
import { startScheduler } from './services/scheduler';

async function main() {
  await migrate();
  const app = createApp();
  const server = http.createServer(app);
  attachRealtime(server);
  startAutomation();
  const stopScheduler = config.ENABLE_SCHEDULER ? startScheduler() : () => {};

  server.listen(config.PORT, () => logger.info(`DigitalBurj Logistics OS API listening on :${config.PORT} (${config.NODE_ENV})`));

  const shutdown = (sig: string) => {
    logger.info(`${sig} received, shutting down`);
    stopScheduler();
    server.close(async () => {
      await pool.end().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error', err);
  process.exit(1);
});
