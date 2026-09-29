import { createApp } from './app';
import { startAutomation } from './services/automation';

/**
 * Serverless entry (Vercel). Same Express app as the long-running server, minus what a stateless function cannot host:
 * no WebSocket hub, no in-process scheduler (a cron route calls the sweep instead) and no boot-time migration
 * (run `npm run db:migrate` as a deploy step).
 */
startAutomation();
const app = createApp();
export default app;
