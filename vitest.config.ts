import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120000, // 2 minutes for network calls
    hookTimeout: 60000,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    sequence: {
      concurrent: false, // Run tests sequentially to avoid rate limiting
    },
  },
});
