import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  build: { sourcemap: true, chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], globals: true },
} as any);
