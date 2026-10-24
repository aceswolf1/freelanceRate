/**
 * Theme — R14: dark by default, a toggle that persists in localStorage, and no
 * flash of the wrong theme on the first paint.
 */
import { expect, test } from '@playwright/test'
import { seedDatabase } from '../helpers/servers'
import { gotoApp } from '../helpers/ui'

const STORAGE_KEY = 'billflow:theme'

/** Records every value the `<html>` class attribute ever takes, from the first
 *  moment the document element exists (before the first paint). */
async function watchThemeClass(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __themeClasses: string[], __themeHooked: boolean }
    w.__themeClasses = []
    w.__themeHooked = false
    const attach = (): void => {
      if (w.__themeHooked || !document.documentElement) {
        return
      }
      w.__themeHooked = true
      w.__themeClasses.push(document.documentElement.className)
      new MutationObserver(() => {
        w.__themeClasses.push(document.documentElement.className)
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    }
    attach()
    new MutationObserver(attach).observe(document, { childList: true, subtree: true })
  })
}

test.describe('Theme', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('R14 — dark is the default and no stored preference means dark', async ({ page }) => {
    await gotoApp(page, '/')

    await expect(page.locator('html')).toHaveClass(/app-dark/)
    const stored = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)
    expect(stored).toBeNull()
  })

  test('R14 — the toggle switches to light and the choice survives a reload', async ({ page }) => {
    await gotoApp(page, '/')

    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).not.toHaveClass(/app-dark/)
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('light')

    // Reload — the persisted light theme is restored.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).not.toHaveClass(/app-dark/)

    // …and toggling back to dark persists too.
    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/app-dark/)
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('dark')
  })

  test('R14 — the persisted light theme never flashes dark', async ({ page }) => {
    await watchThemeClass(page)
    await page.addInitScript(key => {
      try {
        localStorage.setItem(key, 'light')
      }
      catch {
        /* storage unavailable */
      }
    }, STORAGE_KEY)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).not.toHaveClass(/app-dark/)

    const observed = await page.evaluate(() => (window as unknown as { __themeClasses: string[] }).__themeClasses)
    expect(observed.length).toBeGreaterThan(0)
    expect(observed.filter(value => value.includes('app-dark'))).toEqual([])
  })

  test('R14 — the boot script that sets the theme class ships in the document head', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()

    // The pre-paint script must be in <head>, before the app bundle.
    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toContain('billflow:theme')
    expect(head).toContain('app-dark')
  })

  test('R14 — the toggle is reachable from the settings page as well', async ({ page }) => {
    await gotoApp(page, '/settings')
    await page.getByTestId('settings-theme-toggle').click()
    await expect(page.locator('html')).not.toHaveClass(/app-dark/)
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('light')
  })
})
