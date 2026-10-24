import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

loadEnv();

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Integration specs run against the isolated test database, never the dev one.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL,
    },
    // Integration specs share one Postgres test DB and truncate between tests,
    // so they must not run concurrently with each other.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/lib/**/*.ts',
        'src/config/**/*.ts',
        'src/modules/**/*.ts',
        'src/app.ts',
      ],
      exclude: [
        '**/*.test.ts',
        // Barrel/wiring files — exercised by the integration specs, not logic.
        'src/modules/*/index.ts',
        // Owned by worker-3 (T8); their own suite measures their coverage.
        'src/modules/invoices/**',
        'src/modules/reports/**',
        'src/server.ts',
        'src/db/**',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
});