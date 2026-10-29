import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
      },
    },
    coverage: {
      provider: 'v8',
      // Everything that ships to the browser plus the Nitro server layer.
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
      exclude: [
        'app/types/**', // pure TypeScript type declarations — no runtime code
        '**/*.d.ts',
        '.nuxt/**',
        '.output/**',
        'test/**', // the test suite itself is never part of the product
        '**/*.test.ts',
        '**/*.config.ts',
        '**/node_modules/**',
      ],
      reporter: ['text-summary', 'text', 'html'],
      reportsDirectory: 'coverage',
      // Guard against regressions. The numbers sit just below what the suite
      // actually achieves, so a small dip does not turn CI red while a real
      // drop in coverage still does.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 77,
        branches: 69,
      },
    },
  },
})
