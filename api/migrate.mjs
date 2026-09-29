// Vercel function: applies pending DB migrations (see apps/api/src/migrateHandler.ts). Off unless MIGRATE_TOKEN is set.
export { default } from '../apps/api/dist/migrateHandler.js';
