/**
 * Earnings — R13 (by project and by client with gross, fees, net, hours),
 * plus the §8.1 "not yet invoiced" block.
 *
 * The numbers asserted here are the seeded week's real figures:
 *   E-Commerce Storefront 15.5 h × $130 = $2,015.00   (Acme Corp, fee 1 % Payoneer)
 *   API Microservice      2.0 h × $130 =   $260.00
 *   Video Streaming App  14.5 h × $115 = $1,667.50   (Starlight Media, project override)
 *   Internal Tools        2.5 h ×  $95 =   $237.50   (standalone, no client → no fee)
 */
import { expect, test } from '@playwright/test'
import { apiCall, currentWeek } from '../helpers/api'
import { seedDatabase } from '../helpers/servers'
import { gotoApp } from '../helpers/ui'

/** Close the week and generate the invoices, exactly like a real billing run. */
async function invoiceTheWeek(request: Parameters<typeof apiCall>[0]): Promise<number> {
  const week = await currentWeek(request)
  await apiCall(request, 'post', `/weeks/${week.id}/close`)
  await apiCall(request, 'post', `/weeks/${week.id}/invoices`)
  return week.id
}

function row(page: import('@playwright/test').Page, name: string) {
  return page.getByTestId('earnings-table').getByRole('row').filter({ hasText: name })
}

test.describe('Earnings', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('R13 — the not-yet-invoiced block is shown while the week is still open', async ({ page }) => {
    await gotoApp(page, '/earnings')

    const unbilled = page.getByTestId('unbilled-block')
    await expect(unbilled).toBeVisible()
    await expect(unbilled).toContainText('34.5h')
    await expect(unbilled).toContainText('$4180.00')
  })

  test('R13 — by-project totals equal the invoice totals after generating', async ({ page, request }) => {
    await invoiceTheWeek(request)
    await gotoApp(page, '/earnings')

    const table = page.getByTestId('earnings-table')
    await expect(table).toBeVisible()

    // E-Commerce Storefront — $2,015.00 gross, 1 % Payoneer fee.
    await expect(row(page, 'E-Commerce Storefront')).toContainText('15.5h')
    await expect(row(page, 'E-Commerce Storefront')).toContainText('$2015.00')
    await expect(row(page, 'E-Commerce Storefront')).toContainText('−$20.15')
    await expect(row(page, 'E-Commerce Storefront')).toContainText('$1994.85')

    // API Microservice — same client, so the same 1 % fee.
    await expect(row(page, 'API Microservice')).toContainText('2.0h')
    await expect(row(page, 'API Microservice')).toContainText('$260.00')
    await expect(row(page, 'API Microservice')).toContainText('−$2.60')
    await expect(row(page, 'API Microservice')).toContainText('$257.40')

    // Video Streaming Mobile App — project rate override, Starlight's 1 % fee.
    await expect(row(page, 'Video Streaming Mobile App')).toContainText('14.5h')
    await expect(row(page, 'Video Streaming Mobile App')).toContainText('$1667.50')
    await expect(row(page, 'Video Streaming Mobile App')).toContainText('−$16.68')
    await expect(row(page, 'Video Streaming Mobile App')).toContainText('$1650.82')

    // Standalone work has no client, hence no platform and no fee. Grouped by
    // project it shows up under the standalone project's own name.
    await expect(row(page, 'Internal Tools')).toContainText('2.5h')
    await expect(row(page, 'Internal Tools')).toContainText('$237.50')
    await expect(row(page, 'Internal Tools')).toContainText('−$0.00')
    await expect(row(page, 'Internal Tools')).toContainText('$237.50')

    // Totals footer: 34.5 h · $4,180.00 · −$39.43 · $4,140.57
    const footer = page.getByTestId('earnings-totals-footer')
    await expect(footer).toContainText('34.5h')
    await expect(footer).toContainText('$4180.00')
    await expect(footer).toContainText('−$39.43')
    await expect(page.getByTestId('earnings-total-net')).toContainText('$4140.57')

    // Everything is invoiced now, so the "not yet invoiced" block is gone.
    await expect(page.getByTestId('unbilled-block')).toHaveCount(0)
  })

  test('R13 — by-client totals equal the invoice totals after generating', async ({ page, request }) => {
    await invoiceTheWeek(request)
    await gotoApp(page, '/earnings')

    // Switch the grouping to "By client".
    await page.getByTestId('earnings-groupby').getByText('By client').click()

    await expect(row(page, 'Acme Corp')).toContainText('17.5h')
    await expect(row(page, 'Acme Corp')).toContainText('$2275.00')
    await expect(row(page, 'Acme Corp')).toContainText('−$22.75')
    await expect(row(page, 'Acme Corp')).toContainText('$2252.25')

    await expect(row(page, 'Starlight Media')).toContainText('14.5h')
    await expect(row(page, 'Starlight Media')).toContainText('$1667.50')
    await expect(row(page, 'Starlight Media')).toContainText('−$16.68')
    await expect(row(page, 'Starlight Media')).toContainText('$1650.82')

    await expect(row(page, 'No client')).toContainText('$237.50')

    const footer = page.getByTestId('earnings-totals-footer')
    await expect(footer).toContainText('$4180.00')
    await expect(page.getByTestId('earnings-total-net')).toContainText('$4140.57')
  })

  test('R13 — the API report matches the invoice totals', async ({ request }) => {
    await invoiceTheWeek(request)

    const byClient = await apiCall<{ data: { rows: Array<{ name: string, hours: number, gross: number, fees: number, net: number }>, totals: { hours: number, gross: number, fees: number, net: number } } }>(
      request,
      'get',
      '/reports/earnings?groupBy=client',
    )
    const client = (byClient.json as { data: { rows: Array<{ name: string, hours: number, gross: number, fees: number, net: number }>, totals: { hours: number, gross: number, fees: number, net: number } } }).data

    expect(client.totals).toEqual({ hours: 34.5, gross: 4180, fees: 39.43, net: 4140.57 })

    const acme = client.rows.find(row => row.name === 'Acme Corp')!
    expect(acme).toEqual({ id: expect.anything(), name: 'Acme Corp', hours: 17.5, gross: 2275, fees: 22.75, net: 2252.25 })

    const starlight = client.rows.find(row => row.name === 'Starlight Media')!
    expect(starlight.gross).toBe(1667.5)
    expect(starlight.fees).toBe(16.68)
    expect(starlight.net).toBe(1650.82)

    const standalone = client.rows.find(row => row.name === 'No client')!
    expect(standalone.fees).toBe(0)
    expect(standalone.net).toBe(237.5)
  })
})
