import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/migrate.ts', 'src/seed.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  splitting: false,
  // the workspace package ships TypeScript source, so inline it; everything else stays a runtime dependency
  noExternal: ['@digitalburj/shared'],
});
