import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/migrate.ts', 'src/seed.ts', 'src/serverless.ts', 'src/cron.ts', 'src/demoSeed.ts', 'src/migrateHandler.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  splitting: false,
  // the workspace package ships TypeScript source, so inline it; everything else stays a runtime dependency
  noExternal: ['@digitalburj/shared'],
  // optional integrations are loaded lazily at runtime; keep them out of the bundle
  external: ['@aws-sdk/client-s3', 'pdf-parse'],
});
