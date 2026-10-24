/**
 * Invoice Generator — R9 (one invoice per client bucket), R10 (content + snapshot
 * + idempotency), R11 (PDF + zip), R12 (mailto + copy formatted), R7 (reopen is
 * refused once invoices exist).
 *
 * The whole flow runs against the real API: close the week, generate, then read
 * the actual PDF/zip bytes that the browser downloads.
 */
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { apiCall, currentWeek, expectEnvelope, expectError, type InvoiceDto } from '../helpers/api'
import { weekStart } from '../helpers/dates'
import { seedDatabase } from '../helpers/servers'
import { expectToast, gotoApp } from '../helpers/ui'

const ACME = 'Acme Corp'
const STARLIGHT = 'Starlight Media'
const NO_CLIENT = 'No client'

/** Close the seeded week through the API so the invoice page starts closed. */
async function closeWeek(request: Parameters<typeof apiCall>[0]): Promise<number> {
  const week = await currentWeek(request)
  await apiCall(request, 'post', `/weeks/${week.id}/close`)
  return week.id
}

test.describe('Invoice generator', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('R9 — an open week previews three buckets and blocks generation', async ({ page, request }) => {
    const week = await currentWeek(request)
    await gotoApp(page, `/invoices?weekId=${week.id}`)

    // Preview buckets, one per client + the standalone bucket.
    await expect(page.getByTestId(`invoice-card-${ACME}`)).toBeVisible()
    await expect(page.getByTestId(`invoice-card-${STARLIGHT}`)).toBeVisible()
    await expect(page.getByTestId(`invoice-card-${NO_CLIENT}`)).toBeVisible()
    await expect(page.locator('[data-testid^="invoice-card-"]')).toHaveCount(3)

    // Nothing is issued yet.
    await expect(page.getByTestId(`invoice-number-${ACME}`)).toHaveCount(0)
    await expect(page.getByTestId('invoice-card-Acme Corp')).toContainText('Preview — not generated')
    await expect(page.getByTestId('invoice-count-badge')).toContainText('3 Preview Buckets')

    // Generation is impossible while the week is open.
    await expect(page.getByTestId('generate-invoices')).toBeDisabled()
    await expect(page.getByTestId('invoice-week-status')).toHaveText(/Open/)
    await expect(page.getByText('Close the week to generate invoices')).toBeVisible()

    // R8 — informational, never blocking.
    await expect(page.getByTestId('below-target-warning')).toBeVisible()
  })

  test('R9/R10 — a closed week generates one invoice per bucket with the right money', async ({ page, request }) => {
    const weekId = await closeWeek(request)
    await gotoApp(page, `/invoices?weekId=${weekId}`)

    await expect(page.getByTestId('generate-invoices')).toBeEnabled()
    await page.getByTestId('generate-invoices').click()

    // Below target → the UI asks for confirmation but still allows it (R8).
    const confirmButton = page.getByRole('button', { name: 'Generate anyway' })
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click()
    }

    await expectToast(page, '3 invoices generated')
    await expect(page.getByTestId('invoice-count-badge')).toContainText('3 Invoices')

    // Exactly two client cards + the standalone bucket.
    await expect(page.locator('[data-testid^="invoice-card-"]')).toHaveCount(3)
    await expect(page.getByTestId(`invoice-card-${ACME}`)).toBeVisible()
    await expect(page.getByTestId(`invoice-card-${STARLIGHT}`)).toBeVisible()
    await expect(page.getByTestId(`invoice-card-${NO_CLIENT}`)).toBeVisible()

    // R3/R10 — fee = gross × percent + flat, net = gross − fee.
    await expect(page.getByTestId(`invoice-gross-${ACME}`)).toHaveText('$2275.00')
    await expect(page.getByTestId(`invoice-fee-${ACME}`)).toHaveText(/[-−]\$22\.75/)
    await expect(page.getByTestId(`invoice-net-${ACME}`)).toHaveText('$2252.25')

    await expect(page.getByTestId(`invoice-gross-${STARLIGHT}`)).toHaveText('$1667.50')
    await expect(page.getByTestId(`invoice-fee-${STARLIGHT}`)).toHaveText(/[-−]\$16\.68/)
    await expect(page.getByTestId(`invoice-net-${STARLIGHT}`)).toHaveText('$1650.82')

    // The standalone bucket has no client, hence no platform and no fee.
    await expect(page.getByTestId(`invoice-gross-${NO_CLIENT}`)).toHaveText('$237.50')
    await expect(page.getByTestId(`invoice-fee-${NO_CLIENT}`)).toHaveText(/[-−]\$0\.00/)
    await expect(page.getByTestId(`invoice-net-${NO_CLIENT}`)).toHaveText('$237.50')

    // Every card carries an invoice number.
    for (const client of [ACME, STARLIGHT, NO_CLIENT]) {
      await expect(page.getByTestId(`invoice-number-${client}`)).toHaveText(/^INV-\d{4}-\d{3}$/)
    }
  })

  test('R10 — regenerating is idempotent', async ({ page, request }) => {
    const weekId = await closeWeek(request)
    await gotoApp(page, `/invoices?weekId=${weekId}`)

    await page.getByTestId('generate-invoices').click()
    const confirmButton = page.getByRole('button', { name: 'Generate anyway' })
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click()
    }
    await expectToast(page, '3 invoices generated')

    const numbersBefore = await Promise.all(
      [ACME, STARLIGHT, NO_CLIENT].map(client => page.getByTestId(`invoice-number-${client}`).innerText()),
    )

    // Regenerate — the API returns the same invoices.
    await page.getByTestId('generate-invoices').click()
    await expect(page.getByTestId('invoice-count-badge')).toContainText('3 Invoices')

    const numbersAfter = await Promise.all(
      [ACME, STARLIGHT, NO_CLIENT].map(client => page.getByTestId(`invoice-number-${client}`).innerText()),
    )
    expect(numbersAfter).toEqual(numbersBefore)

    // …and the API really stores three rows, not six.
    const listed = await apiCall<{ data: InvoiceDto[] }>(request, 'get', `/weeks/${weekId}/invoices`)
    const invoices = expectEnvelope(listed)
    expect(invoices).toHaveLength(3)
    expect(invoices.map(invoice => invoice.number).sort()).toEqual([...numbersBefore].sort())
  })

  test('R11 — the PDF download is a real PDF with the contracted filename', async ({ page, request }) => {
    const weekId = await closeWeek(request)
    await gotoApp(page, `/invoices?weekId=${weekId}`)

    await page.getByTestId('generate-invoices').click()
    const confirmButton = page.getByRole('button', { name: 'Generate anyway' })
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click()
    }
    await expect(page.getByTestId('invoice-count-badge')).toContainText('3 Invoices')

    const number = (await page.getByTestId(`invoice-number-${ACME}`).innerText()).trim()
    expect(number).toMatch(/^INV-\d{4}-\d{3}$/)

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId(`download-pdf-${ACME}`).click()
    const download = await downloadPromise

    // Contract §4.5 — `INV-2026-001-acme-corp.pdf`.
    expect(download.suggestedFilename()).toBe(`${number}-acme-corp.pdf`)
    expect(download.suggestedFilename()).toMatch(/^INV-\d{4}-\d{3}-acme-corp\.pdf$/)

    const path = await download.path()
    const bytes = await readFile(path)
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('%PDF')
    expect(bytes.length).toBeGreaterThan(1000)
  })

  test('R11 — the zip download contains one PDF per invoice', async ({ page, request }) => {
    const weekId = await closeWeek(request)
    await gotoApp(page, `/invoices?weekId=${weekId}`)

    await page.getByTestId('generate-invoices').click()
    const confirmButton = page.getByRole('button', { name: 'Generate anyway' })
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click()
    }
    await expect(page.getByTestId('invoice-count-badge')).toContainText('3 Invoices')

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('download-zip').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^invoices-week-\d+\.zip$/)

    const path = await download.path()
    const bytes = await readFile(path)
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('PK\x03\x04')

    const asText = bytes.toString('latin1')
    for (const client of [ACME, STARLIGHT, NO_CLIENT]) {
      const number = (await page.getByTestId(`invoice-number-${client}`).innerText()).trim()
      const slug = client.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      expect(asText).toContain(`${number}-${slug}.pdf`)
    }

    // Exactly three entries (one local file header per entry).
    const entries = asText.split('PK\x03\x04').length - 1
    expect(entries).toBe(3)
  })

  test('R12 — "Send as Email Text" builds a mailto link with the client address', async ({ page, request }) => {
    const weekId = await closeWeek(request)
    await gotoApp(page, `/invoices?weekId=${weekId}`)

    await page.getByTestId('generate-invoices').click()
    const confirmButton = page.getByRole('button', { name: 'Generate anyway' })
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click()
    }
    await expect(page.getByTestId('invoice-count-badge')).toContainText('3 Invoices')

    const mailto = page.getByTestId(`mailto-${ACME}`)
    await expect(mailto).toBeVisible()
    const href = await mailto.getAttribute('href')
    expect(href).toBeTruthy()
    expect(href!.startsWith('mailto:')).toBe(true)
    expect(href).toContain('billing@acme.example')
    expect(decodeURIComponent(href!)).toContain('finance@acme.example')
    expect(decodeURIComponent(href!)).toContain('subject=')

    // Starlight has no cc address, so no cc parameter is emitted.
    const starlightHref = await page.getByTestId(`mailto-${STARLIGHT}`).getAttribute('href')
    expect(starlightHref).toContain('accounts@starlight.example')
    expect(starlightHref).not.toContain('cc=')
  })

  test('R12 — "Copy formatted" puts the HTML table on the clipboard and confirms with a toast', async ({ page, request }) => {
    const weekId = await closeWeek(request)
    await gotoApp(page, `/invoices?weekId=${weekId}`)

    await page.getByTestId('generate-invoices').click()
    const confirmButton = page.getByRole('button', { name: 'Generate anyway' })
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click()
    }
    await expect(page.getByTestId('invoice-count-badge')).toContainText('3 Invoices')

    await page.getByTestId(`copy-formatted-${ACME}`).click()
    await expectToast(page, 'Invoice copied')

    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('E-Commerce Storefront')
    expect(clipboard).toContain('Acme Corp')
  })

  test('R7 — a week with invoices cannot be reopened', async ({ page, request }) => {
    const week = await currentWeek(request)
    await apiCall(request, 'post', `/weeks/${week.id}/close`)
    await apiCall(request, 'post', `/weeks/${week.id}/invoices`)

    // The API refuses with 409 CONFLICT.
    const reopened = await apiCall(request, 'post', `/weeks/${week.id}/reopen`)
    expectError(reopened, 409, 'CONFLICT')

    // …and the UI disables the button, explaining why.
    await gotoApp(page, '/')
    await expect(page.getByTestId('week-status')).toHaveText(/Closed/)
    await expect(page.getByTestId('reopen-week')).toBeDisabled()
  })

  test('R9 — the API refuses to invoice an open week', async ({ request }) => {
    const week = await currentWeek(request)
    const result = await apiCall(request, 'post', `/weeks/${week.id}/invoices`)
    expectError(result, 409, 'CONFLICT')
  })

  test('R10 — the invoice snapshot keeps the client details of the billing period', async ({ request }) => {
    const week = await currentWeek(request)
    const expectedYear = weekStart(week.startDate).slice(0, 4)

    await apiCall(request, 'post', `/weeks/${week.id}/close`)
    const generated = await apiCall<{ data: InvoiceDto[] }>(request, 'post', `/weeks/${week.id}/invoices`)
    const invoices = expectEnvelope(generated, 201)

    expect(invoices).toHaveLength(3)
    const acme = invoices.find(invoice => invoice.clientName === ACME)!
    expect(acme.number.startsWith(`INV-${expectedYear}-`)).toBe(true)
    expect(acme.contactEmail).toBe('billing@acme.example')
    expect(acme.ccEmail).toBe('finance@acme.example')
    expect(acme.platformCompany).toBe('Payoneer')
    expect(acme.gross).toBe(2275)
    expect(acme.feeAmount).toBe(22.75)
    expect(acme.net).toBe(2252.25)
    expect(acme.periodStart).toBe(week.startDate)
    expect(acme.periodEnd).toBe(week.endDate)

    // Line items carry date, project, hours, rate and total (R10).
    const line = acme.lines[0]
    expect(line).toBeDefined()
    expect(line.hours).toBeGreaterThan(0)
    expect(line.rate).toBeGreaterThan(0)
    expect(line.lineTotal).toBeCloseTo(line.hours * line.rate, 2)
  })
})
