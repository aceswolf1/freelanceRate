/**
 * Icons and favicon.
 *
 * A PrimeIcons glyph needs **two** classes: the base `pi` (which sets the icon
 * font) and the glyph itself (`pi-calendar`). With only the glyph class the
 * browser draws the private-use code point in the text font and the icon
 * shows up as an empty box — so both the class and the computed font-family
 * are asserted for every sidebar icon and for the theme toggle.
 *
 * The favicon set (SVG + PNG + ICO + apple-touch-icon) is part of the document
 * head and must be served by the frontend.
 */
import { expect, test } from '@playwright/test'
import { FRONTEND_URL } from '../helpers/paths'
import { seedDatabase } from '../helpers/servers'
import { gotoApp } from '../helpers/ui'

interface IconInfo {
  testId: string | null
  className: string
  fontFamily: string
}

test.describe('Icons and favicon', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('every sidebar icon carries the `pi` class and the primeicons font', async ({ page }) => {
    await gotoApp(page, '/')

    const icons: IconInfo[] = await page.evaluate(() => Array.from(
      document.querySelectorAll('nav a i'),
    ).map(element => ({
      testId: element.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
      className: element.getAttribute('class') ?? '',
      fontFamily: getComputedStyle(element).fontFamily,
    })))

    // The sidebar has six entries (Weekly Timesheet … Settings).
    expect(icons.length).toBe(6)

    for (const icon of icons) {
      const classes = icon.className.split(/\s+/).filter(Boolean)
      expect(classes, `${icon.testId} must carry the "pi" class`).toContain('pi')
      // The glyph class is the second one: `pi pi-calendar`.
      expect(classes.length, `${icon.testId} needs a glyph class`).toBeGreaterThanOrEqual(2)
      expect(icon.fontFamily.toLowerCase(), `${icon.testId} must use the primeicons font`).toContain('primeicons')
    }

    // The icons are the ones the navigation config asks for.
    const glyphs = icons.map(icon => icon.className.split(/\s+/).find(name => name !== 'pi' && !name.startsWith('text-')))
    expect(glyphs).toEqual([
      'pi-calendar',
      'pi-receipt',
      'pi-users',
      'pi-folder-open',
      'pi-chart-bar',
      'pi-cog',
    ])
  })

  test('the theme toggle icon is a real PrimeIcons glyph', async ({ page }) => {
    await gotoApp(page, '/')

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toBeVisible()

    const icon: IconInfo = await toggle.locator('i').evaluate(element => ({
      testId: 'theme-toggle',
      className: element.getAttribute('class') ?? '',
      fontFamily: getComputedStyle(element).fontFamily,
    }))

    expect(icon.className.split(/\s+/)).toContain('pi')
    expect(icon.fontFamily.toLowerCase()).toContain('primeicons')
    // The glyph follows the theme: moon in dark, sun in light.
    expect(icon.className.split(/\s+/).some(name => name === 'pi-moon' || name === 'pi-sun')).toBe(true)
  })

  test('the document head links the SVG favicon', async ({ page }) => {
    await gotoApp(page, '/')

    const icon = page.locator('link[rel="icon"][href="/favicon.svg"]')
    await expect(icon).toHaveCount(1)
    await expect(icon).toHaveAttribute('type', 'image/svg+xml')

    // The PNG fallback and the apple-touch icon ship with it.
    await expect(page.locator('link[rel="icon"][href="/favicon-32.png"]')).toHaveCount(1)
    await expect(page.locator('link[rel="apple-touch-icon"][href="/apple-touch-icon.png"]')).toHaveCount(1)
  })

  test('every favicon file is served', async ({ request }) => {
    const files = [
      { path: '/favicon.svg', type: 'image/svg+xml' },
      { path: '/favicon-32.png', type: 'image/png' },
      { path: '/favicon.ico', type: 'icon' },
      { path: '/apple-touch-icon.png', type: 'image/png' },
    ]

    for (const file of files) {
      const response = await request.get(`${FRONTEND_URL}${file.path}`)
      expect(response.status(), `${file.path} must be served`).toBe(200)
      expect(response.headers()['content-type'], `${file.path} content type`).toContain(file.type)
      const body = await response.body()
      expect(body.length, `${file.path} must not be empty`).toBeGreaterThan(0)
    }

    // The SVG really is an SVG.
    const svg = await request.get(`${FRONTEND_URL}/favicon.svg`)
    expect(await svg.text()).toContain('<svg')
  })
})
