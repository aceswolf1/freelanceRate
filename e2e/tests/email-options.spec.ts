/**
 * Settings → Email content (R12) — the three switches that decide what the
 * copied invoice email may reveal to the client:
 *
 *   · Show rate  → a "Rate" column in every project table
 *   · Show gross → a "Gross" line in the totals
 *   · Show fee   → the payment-platform fee line in the totals
 *
 * All three are **off** by default, so the client sees hours, line totals and
 * the amount due only. Hours, line totals and "Net due" are always there.
 *
 * The email is read from the real endpoint (`GET /api/invoices/:id/email`), the
 * same payload the "Send as Email Text" mailto link is built from.
 */
import { expect, test, type Page } from '@playwright/test'
import { apiCall, currentWeek, expectEnvelope, type InvoiceDto } from '../helpers/api'
import { seedDatabase } from '../helpers/servers'
import { expectToast, gotoApp } from '../helpers/ui'

const ACME = 'Acme Corp'
const RATE = 'settings-email-rate'
const GROSS = 'settings-email-gross'
const FEE = 'settings-email-fee'

interface EmailDraft {
  to: string
  cc: string | null
  subject: string
  text: string
  html: string
  mailto: string
  truncated: boolean
}

interface SettingsDto {
  emailShowRate: boolean
  emailShowGross: boolean
  emailShowFee: boolean
}

/** Closes the seeded week and generates the invoices; returns them. */
async function generateInvoices(request: Parameters<typeof apiCall>[0]): Promise<InvoiceDto[]> {
  const week = await currentWeek(request)
  await apiCall(request, 'post', `/weeks/${week.id}/close`)
  const result = await apiCall<{ data: InvoiceDto[] }>(request, 'post', `/weeks/${week.id}/invoices`)
  return expectEnvelope(result, 201)
}

/** The plain-text email of the first invoice of a client. */
async function emailDraft(
  request: Parameters<typeof apiCall>[0],
  invoiceId: number,
): Promise<EmailDraft> {
  const result = await apiCall<{ data: EmailDraft }>(request, 'get', `/invoices/${invoiceId}/email`)
  return expectEnvelope(result)
}

/** The state of a PrimeVue ToggleSwitch (`data-p-checked` on its root). */
async function switchIsOn(page: Page, testId: string): Promise<boolean> {
  const value = await page.getByTestId(testId).getAttribute('data-p-checked')
  return value === 'true'
}

/** Flips a switch by clicking its label — the way a user does it. */
async function toggleSwitch(page: Page, testId: string): Promise<void> {
  const before = await switchIsOn(page, testId)
  await page.locator(`label[for="${testId}"]`).click()
  await expect(page.getByTestId(testId)).toHaveAttribute('data-p-checked', String(!before))
}

/** The column-header row of the plain-text email ("Date … Hours … Total"). */
function headerLine(text: string): string {
  const line = text
    .split('\n')
    .find(candidate => /^\s*Date\s/.test(candidate) && candidate.includes('Hours') && candidate.includes('Total'))
  if (!line) {
    throw new Error(`no column header found in the email body:\n${text}`)
  }
  return line
}

test.describe('Settings → Email content', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('the panel shows three switches and all of them are off by default', async ({ page, request }) => {
    await gotoApp(page, '/settings')

    const panel = page.getByTestId('email-content-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Email Content')).toBeVisible()

    // Exactly three switches, each with its own label.
    await expect(page.locator('[data-testid^="settings-email-"]')).toHaveCount(3)
    for (const id of [RATE, GROSS, FEE]) {
      await expect(page.getByTestId(id)).toBeVisible()
      await expect(page.locator(`label[for="${id}"]`)).toBeVisible()
    }
    await expect(page.locator('label[for="settings-email-rate"]')).toContainText('Show rate')
    await expect(page.locator('label[for="settings-email-gross"]')).toContainText('Show gross')
    await expect(page.locator('label[for="settings-email-fee"]')).toContainText('Show fee')

    // All three are off — in the UI …
    expect(await switchIsOn(page, RATE)).toBe(false)
    expect(await switchIsOn(page, GROSS)).toBe(false)
    expect(await switchIsOn(page, FEE)).toBe(false)

    // … and in the database.
    const settings = expectEnvelope(await apiCall<{ data: SettingsDto }>(request, 'get', '/settings'))
    expect(settings.emailShowRate).toBe(false)
    expect(settings.emailShowGross).toBe(false)
    expect(settings.emailShowFee).toBe(false)
  })

  test('with the switches off the email hides the rate column, the gross line and the fee line', async ({ page, request }) => {
    const invoices = await generateInvoices(request)
    const acme = invoices.find(invoice => invoice.clientName === ACME)!
    const draft = await emailDraft(request, acme.id)

    // The header has no Rate column.
    expect(headerLine(draft.text)).not.toContain('Rate')
    expect(draft.html).not.toContain('>Rate<')

    // The totals carry the amount due — and nothing else.
    expect(draft.text).toContain('Net due')
    expect(draft.text).not.toContain('Gross')
    expect(draft.text).not.toContain('Payoneer fee')
    expect(draft.html).not.toContain('Gross')
    expect(draft.html).not.toContain('Payoneer fee')

    // Hours and the line totals are always there.
    expect(draft.text).toContain('Hours')
    expect(draft.text).toContain('E-Commerce Storefront')
    expect(draft.text).toContain('$455.00')
    expect(draft.text).toContain('$2,015.00')

    // The same body reaches the user through the "Send as Email Text" link.
    await gotoApp(page, `/invoices?weekId=${acme.weekId}`)
    const href = await page.getByTestId(`mailto-${ACME}`).getAttribute('href')
    expect(href).toBeTruthy()
    const decoded = decodeURIComponent(href!)
    expect(decoded).toContain('Net due')
    expect(decoded).not.toContain('Gross')
  })

  test('turning all three switches on reveals the rate column, the gross line and the fee line', async ({ page, request }) => {
    const invoices = await generateInvoices(request)
    const acme = invoices.find(invoice => invoice.clientName === ACME)!

    // Flip the three switches and save them.
    await gotoApp(page, '/settings')
    await toggleSwitch(page, RATE)
    await toggleSwitch(page, GROSS)
    await toggleSwitch(page, FEE)
    await page.getByTestId('save-settings').click()
    await expectToast(page, 'Settings saved')

    // They were persisted.
    const settings = expectEnvelope(await apiCall<{ data: SettingsDto }>(request, 'get', '/settings'))
    expect(settings.emailShowRate).toBe(true)
    expect(settings.emailShowGross).toBe(true)
    expect(settings.emailShowFee).toBe(true)

    // The email now carries all three.
    const draft = await emailDraft(request, acme.id)
    // The body still fits into a mailto link, so the "Send as Email Text"
    // anchor below is the full (not shortened) draft.
    expect(draft.truncated).toBe(false)
    expect(headerLine(draft.text)).toContain('Rate')
    expect(draft.html).toContain('>Rate<')
    expect(draft.text).toContain('Gross')
    expect(draft.text).toContain('Payoneer fee')
    expect(draft.text).toContain('Net due')
    expect(draft.html).toContain('Gross')
    expect(draft.html).toContain('Payoneer fee')

    // …and the "Send as Email Text" link carries them too.
    await gotoApp(page, `/invoices?weekId=${acme.weekId}`)
    const href = await page.getByTestId(`mailto-${ACME}`).getAttribute('href')
    const decoded = decodeURIComponent(href!)
    expect(decoded).toContain('Gross')
    expect(decoded).toContain('Payoneer fee')

    // Restore the switches so the next run starts from the documented default.
    await gotoApp(page, '/settings')
    await toggleSwitch(page, RATE)
    await toggleSwitch(page, GROSS)
    await toggleSwitch(page, FEE)
    await page.getByTestId('save-settings').click()
    await expectToast(page, 'Settings saved')

    const restored = expectEnvelope(await apiCall<{ data: SettingsDto }>(request, 'get', '/settings'))
    expect(restored.emailShowRate).toBe(false)
    expect(restored.emailShowGross).toBe(false)
    expect(restored.emailShowFee).toBe(false)
  })

  test('the switches are off again after the suite re-seeds the database', async ({ page, request }) => {
    // The previous test restored them; this one proves the seed resets them.
    await gotoApp(page, '/settings')
    expect(await switchIsOn(page, RATE)).toBe(false)
    expect(await switchIsOn(page, GROSS)).toBe(false)
    expect(await switchIsOn(page, FEE)).toBe(false)

    const settings = expectEnvelope(await apiCall<{ data: SettingsDto }>(request, 'get', '/settings'))
    expect(settings.emailShowRate).toBe(false)
    expect(settings.emailShowGross).toBe(false)
    expect(settings.emailShowFee).toBe(false)
  })
})
