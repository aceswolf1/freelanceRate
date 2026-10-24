/**
 * SSR smoke test.
 *
 * Every route is hard-reloaded (server-side render, no client-side navigation)
 * and must answer 200 with a usable page. This is the regression net for the
 * `NUXT_E1001` class of bug: a composable that calls `useApi()` lazily after an
 * `await` loses the Nuxt context during SSR and the whole route dies.
 */
import { expect, test } from '@playwright/test'
import { apiCall, currentWeek } from '../helpers/api'
import { seedDatabase } from '../helpers/servers'
import { gotoApp } from '../helpers/ui'

const ROUTES = ['/', '/invoices', '/clients', '/projects', '/settings', '/earnings']

test.describe('Server-side rendering', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('every route renders on the server without a Nuxt context error', async ({ request }) => {
    for (const route of ROUTES) {
      const response = await request.get(route)
      expect(response.status(), `SSR status for ${route}`).toBe(200)

      const html = await response.text()
      expect(html, `SSR body for ${route}`).not.toContain('NUXT_E1001')
      expect(html, `SSR body for ${route}`).not.toContain('nuxt-instance')
      expect(html, `SSR body for ${route}`).not.toContain('__nuxt_error')
      expect(html, `SSR body for ${route}`).toContain('<div id="__nuxt">')
    }
  })

  test('the invoice route renders with a week query parameter', async ({ request }) => {
    const week = await currentWeek(request)

    const withWeek = await request.get(`/invoices?weekId=${week.id}`)
    expect(withWeek.status()).toBe(200)
    const html = await withWeek.text()
    expect(html).not.toContain('NUXT_E1001')
    expect(html).toContain(week.label)

    // An unknown week id must degrade gracefully, not crash the renderer.
    const unknown = await request.get('/invoices?weekId=999999')
    expect(unknown.status()).toBe(200)
    expect(await unknown.text()).not.toContain('NUXT_E1001')
  })

  test('every route hydrates in the browser without console errors', async ({ page }) => {
    const problems: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        problems.push(message.text())
      }
    })
    page.on('pageerror', error => problems.push(error.message))

    for (const route of ROUTES) {
      await gotoApp(page, route)
      await expect(page.locator('#__nuxt')).toBeVisible()
    }

    const relevant = problems.filter(text => /NUXT_E1001|Cannot read properties of (null|undefined)|is not defined/.test(text))
    expect(relevant, `console errors: ${problems.join(' | ')}`).toEqual([])
  })

  test('the API answers a hard reload of the current week', async ({ request }) => {
    const result = await apiCall<{ data: { id: number, label: string } }>(request, 'get', '/weeks/current')
    expect(result.status).toBe(200)
  })

  // GAP-009 (resolved) — the layout now fetches the current week during SSR,
  // so the sidebar's active-week card renders the same markup on both sides.
  test('no route reports a hydration mismatch', async ({ page }) => {
    for (const route of ROUTES) {
      const problems: string[] = []
      const onConsole = (message: { type: () => string, text: () => string }) => {
        if (message.type() === 'error') {
          problems.push(message.text())
        }
      }
      page.on('console', onConsole)
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
      page.off('console', onConsole)

      const mismatches = problems.filter(text => /Hydration|mismatch/i.test(text))
      expect(mismatches, `hydration errors on ${route}`).toEqual([])
    }
  })
})
