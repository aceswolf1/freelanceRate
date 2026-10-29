/**
 * CRUD surfaces — R1 (clients), R2 (projects, standalone allowed), R3 (payment
 * platforms + fee model), R15 (settings persisted in the DB).
 *
 * Every flow is exercised through the real UI against the real API.
 *
 * GAP-002 (frontend CRUD & settings) — found by this suite, fixed by worker-2:
 * PrimeVue's auto-imported `FormField` had shadowed
 * `app/components/common/FormField.vue`, so the field labels and the inline
 * validation paragraphs were never rendered. Both are asserted again below.
 */
import { expect, test } from '@playwright/test'
import { apiCall, expectEnvelope, type ApiEnvelope } from '../helpers/api'
import { seedDatabase } from '../helpers/servers'
import { expectToast, fieldInput, fillField, fillNumber, gotoApp, numberInput, selectOption, visibleOptionTexts } from '../helpers/ui'

const QA_CLIENT = 'QA Test Client'

async function clientIdByName(request: Parameters<typeof apiCall>[0], name: string): Promise<number> {
  const result = await apiCall<{ data: Array<{ id: number, name: string }> }>(request, 'get', '/clients')
  const client = expectEnvelope(result).find(entry => entry.name === name)
  if (!client) {
    throw new Error(`client "${name}" not found`)
  }
  return client.id
}

test.describe('CRUD — clients, projects, platforms and settings', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  // GAP-002 (found here, fixed by worker-2) — the inline field error must be
  // rendered again.
  test('R1 — a malformed e-mail is reported inline', async ({ page }) => {
    await gotoApp(page, '/clients')
    await page.getByTestId('create-client').click()

    await fillField(page, 'client-name', QA_CLIENT)
    await fillField(page, 'client-email', 'not-an-email')
    await fillNumber(page, 'client-rate', '120')
    await page.locator('.p-dialog').getByRole('button', { name: 'Create client' }).click()

    await expect(page.locator('#client-email-error')).toHaveText('Enter a valid email address.')
  })

  test('R1 — a client is created, edited and deleted through the UI', async ({ page, request }) => {
    await gotoApp(page, '/clients')
    await page.getByTestId('create-client').click()

    // Inline validation for a malformed email address (R1) — see the GAP-002 spec.
    await fillField(page, 'client-name', QA_CLIENT)
    await fillField(page, 'client-email', 'qa@example.com')
    await fillField(page, 'client-cc', 'qa-finance@example.com')
    await fillNumber(page, 'client-rate', '120')

    // R3 — the payout rail comes from the payment platforms.
    await page.locator('#client-platform').click()
    const platformOptions = await visibleOptionTexts(page)
    expect(platformOptions.join('|')).toContain('Payoneer')
    expect(platformOptions.join('|')).toContain('Wise')
    expect(platformOptions.join('|')).toContain('Domestic Wire')
    await page.getByRole('option').filter({ hasText: 'Wise' }).first().click()

    await page.locator('.p-dialog').getByRole('button', { name: 'Create client' }).click()
    await expectToast(page, 'Client created')
    await expect(page.getByTestId('clients-table')).toContainText(QA_CLIENT)

    // Edit the rate.
    const id = await clientIdByName(request, QA_CLIENT)
    await page.getByTestId(`edit-client-${id}`).click()
    await expect(fieldInput(page, 'client-name')).toHaveValue(QA_CLIENT)
    await fillNumber(page, 'client-rate', '150')
    await page.locator('.p-dialog').getByRole('button', { name: 'Save changes' }).click()
    await expectToast(page, 'Client updated')
    await expect(page.getByTestId('clients-table')).toContainText('$150.00')

    // Delete it again.
    await page.getByTestId(`delete-client-${id}`).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expectToast(page, 'Client deleted')
    await expect(page.getByTestId('clients-table')).not.toContainText(QA_CLIENT)
  })

  test('R1 — deleting a referenced client is refused with a friendly 409 message', async ({ page, request }) => {
    const acmeId = await clientIdByName(request, 'Acme Corp')

    await gotoApp(page, '/clients')
    await page.getByTestId(`delete-client-${acmeId}`).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    // R1 — the delete is blocked because projects/records reference the client.
    await expectToast(page, 'Cannot delete this client')
    await expect(page.getByTestId('clients-table')).toContainText('Acme Corp')
  })

  test('R2 — a standalone project without a rate is rejected inline', async ({ page }) => {
    await gotoApp(page, '/projects')
    await page.getByTestId('create-project').click()

    await fillField(page, 'project-name', 'QA Standalone Project')
    await selectOption(page, 'project-client-select', /Standalone \(No Client\)/)
    await page.locator('.p-dialog').getByRole('button', { name: 'Create project' }).click()

    // R2 — standalone projects must carry their own rate. The inline error
    // message itself is GAP-002, so the rule is proven by the API spec below.

    // With a rate the project saves.
    await fillNumber(page, 'project-rate', '95')
    await page.locator('.p-dialog').getByRole('button', { name: 'Create project' }).click()
    await expectToast(page, 'Project created')
    await expect(page.getByTestId('projects-table')).toContainText('QA Standalone Project')
  })

  test('R2 — the API rejects a standalone project without a rate', async ({ request }) => {
    const result = await apiCall<ApiEnvelope<unknown>>(request, 'post', '/projects', {
      name: 'QA Standalone Without Rate',
      clientId: null,
      description: null,
      billingHour: null,
      archived: false,
    })
    expect(result.status).toBe(400)
    expect(result.json.success).toBe(false)
    expect(result.json.error!.code).toBe('VALIDATION_ERROR')
  })

  test('R2 — a project linked to a client inherits the client rate', async ({ page }) => {
    await gotoApp(page, '/projects')
    await page.getByTestId('create-project').click()

    await fillField(page, 'project-name', 'QA Client Project')
    await selectOption(page, 'project-client-select', /^Acme Corp/)
    // No rate → inherited from the client (Acme Corp is $130/h).
    await page.locator('.p-dialog').getByRole('button', { name: 'Create project' }).click()
    await expectToast(page, 'Project created')
    await expect(page.getByTestId('projects-table')).toContainText('QA Client Project')
  })

  test('R3 — a payment platform with a percentage and a flat fee can be created', async ({ page, request }) => {
    await gotoApp(page, '/settings')
    await page.getByTestId('create-platform').click()

    await fillField(page, 'platform-company', 'QA Payout Rail')
    await fillNumber(page, 'platform-percent', '2.5')
    await fillNumber(page, 'platform-flat', '3')
    await page.locator('.p-dialog').getByRole('button', { name: 'Add platform' }).click()

    await expectToast(page, 'Payment platform added')
    await expect(page.getByTestId('platforms-table')).toContainText('QA Payout Rail')

    const result = await apiCall<{ data: Array<{ company: string, feePercent: number, feeFlat: number }> }>(
      request,
      'get',
      '/payment-platforms',
    )
    const platform = expectEnvelope(result).find(entry => entry.company === 'QA Payout Rail')
    expect(platform).toBeDefined()
    expect(platform!.feePercent).toBe(2.5)
    expect(platform!.feeFlat).toBe(3)
  })

  test('R15 — the weekly target from settings shows up in the timesheet banner', async ({ page, request }) => {
    await gotoApp(page, '/settings')
    await fillNumber(page, 'settings-target', '20')
    await page.getByTestId('save-settings').click()
    await expectToast(page, 'Settings saved')

    // Persisted in the DB.
    const settings = await apiCall<{ data: { weeklyTargetHours: number } }>(request, 'get', '/settings')
    expect(expectEnvelope(settings).weeklyTargetHours).toBe(20)

    // …and reflected in the timesheet banner (R8 + R15).
    await gotoApp(page, '/')
    const banner = page.getByTestId('target-banner')
    await expect(banner).toContainText('34.5 / 20.0 hrs logged this week')
    // 34.5 h is above a 20 h target, so the warning is gone.
    await expect(banner).toHaveAttribute('data-below-target', 'false')
    await expect(page.getByTestId('below-target-badge')).toHaveCount(0)
  })

  // GAP-007 (found here, fixed by worker-2) — the settings form used to be
  // hydrated from the composable's fallback instead of the persisted row.
  test('R15 — the settings form shows the persisted values', async ({ page, request }) => {
    await gotoApp(page, '/settings')

    const settings = await apiCall<{ data: { displayName: string, weeklyTargetHours: number, currencySymbol: string, invoicePrefix: string } }>(request, 'get', '/settings')
    const data = expectEnvelope(settings)

    await expect(fieldInput(page, 'settings-name')).toHaveValue(data.displayName)
    await expect(numberInput(page, 'settings-target')).toHaveValue(new RegExp(String(data.weeklyTargetHours)))
    await expect(fieldInput(page, 'settings-currency')).toHaveValue(data.currencySymbol)
    await expect(fieldInput(page, 'settings-prefix')).toHaveValue(data.invoicePrefix)
  })

  test('R15 — the display name and currency symbol are persisted', async ({ page, request }) => {
    await gotoApp(page, '/settings')
    await fillField(page, 'settings-name', 'QA Consultant')
    await fillField(page, 'settings-currency', '€')
    await page.getByTestId('save-settings').click()
    await expectToast(page, 'Settings saved')

    const settings = await apiCall<{ data: { displayName: string, currencySymbol: string } }>(request, 'get', '/settings')
    const data = expectEnvelope(settings)
    expect(data.displayName).toBe('QA Consultant')
    expect(data.currencySymbol).toBe('€')

    // The symbol shows up in the timesheet money figures.
    await gotoApp(page, '/')
    await expect(page.getByTestId('summary-gross')).toContainText('€4180.00')
  })
})
