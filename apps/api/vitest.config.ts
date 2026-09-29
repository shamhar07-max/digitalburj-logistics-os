import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false, // API tests share one database
    testTimeout: 30_000,
    hookTimeout: 180_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://digitalburj:dev_password@localhost:5432/digitalburj_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      ENABLE_SCHEDULER: 'false',
      WHATSAPP_APP_SECRET: 'wa-test-secret',
      WHATSAPP_VERIFY_TOKEN: 'verify-me',
    },
  },
});
