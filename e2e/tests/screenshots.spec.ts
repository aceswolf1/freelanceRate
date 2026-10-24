/**
 * Design screenshots — 6 pages × 2 themes, written to the QA task folder so the
 * implementation can be compared against `.claude/design/*\/screen.png`.
 *
 * The `/invoices` page is captured with a **closed and invoiced** week, which is
 * the state the design mock-up shows.
 */
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { apiCall, currentWeek } from '../helpers/api'
import { seedDatabase } from '../helpers/servers'
import { SCREENSHOT_DIR } from '../helpers/paths'
import { gotoApp } from '../helpers/ui'

const PAGES: Array<{ name: string, path: string }> = [
  { name: 'timesheet', path: '/' },
  { name: 'invoices', path: '/invoices' },
  { name: 'clients', path: '/clients' },
  { name: 'projects', path: '/projects' },
  { name: 'settings', path: '/settings' },
  { name: 'earnings', path: '/earnings' },
]

test.describe('Screenshots', () => {
  test.beforeEach(async ({ request }) => {
    seedDatabase()
    mkdirSync(SCREENSHOT_DIR, { recursive: true })
  })

  for (const theme of ['dark', 'light'] as const) {
    for (const target of PAGES) {
      test(`${target.name} — ${theme}`, async ({ page, request }) => {
        // The invoice page is captured in its "issued" state (closed week +
        // generated invoices); the other pages show the default open week.
        if (target.path.startsWith('/invoices')) {
          const week = await currentWeek(request)
          await apiCall(request, 'post', `/weeks/${week.id}/close`)
          await apiCall(request, 'post', `/weeks/${week.id}/invoices`)
        }

        if (theme === 'light') {
          await page.addInitScript(() => {
            try {
              localStorage.setItem('billflow:theme', 'light')
            }
            catch {
              /* storage unavailable */
            }
          })
        }

        await gotoApp(page, target.path)
        await expect(page.locator('#__nuxt')).toBeVisible()
        await page.waitForTimeout(1200)

        await page.screenshot({ path: `${SCREENSHOT_DIR}/${target.name}-${theme}.png` })
      })
    }
  }
})
