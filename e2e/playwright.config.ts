import { defineConfig, devices } from '@playwright/test'
import { FRONTEND_URL } from './helpers/paths'

/**
 * Playwright configuration for the BillFlow E2E suite.
 *
 * The suite drives a **real** stack: the team's API on :4400 (through the CORS
 * proxy on :4401, see `helpers/paths.ts`) and the production Nuxt build served on
 * :3300. Nothing is mocked.
 *
 * Tests run **serially** (`workers: 1`, `fullyParallel: false`) because they all
 * share one dev database: several of them close the seeded week and generate
 * invoices, which are not reversible through the API.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],

  use: {
    baseURL: FRONTEND_URL,
    // 1920×1080 keeps the seven day columns wide enough to compare with
    // `.claude/design/*/screen.png` (2200×1124).
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // "Copy formatted" writes an HTML table to the clipboard (R12).
    permissions: ['clipboard-read', 'clipboard-write'],
    actionTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
})
