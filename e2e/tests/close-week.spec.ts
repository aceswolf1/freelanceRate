/**
 * Close / reopen a week — R7.
 *
 * A closed week must be read-only in the UI (no add affordance, no per-record
 * actions, form controls disabled) and must reject every record mutation at the
 * API level with 409 `WEEK_CLOSED`.
 */
import { expect, test } from '@playwright/test'
import { apiCall, currentWeek, expectEnvelope, expectError } from '../helpers/api'
import { todayIso, weekStart } from '../helpers/dates'
import { seedDatabase } from '../helpers/servers'
import { expectToast, gotoApp } from '../helpers/ui'

test.describe('Close and reopen a week', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('R7 — closing the week turns every write affordance off', async ({ page }) => {
    await gotoApp(page, '/')

    // Open week: the add affordance is there.
    await expect(page.getByTestId('week-status')).toHaveText(/Open/)
    await expect(page.locator('[data-testid^="add-record-"]')).toHaveCount(7)
    await expect(page.getByTestId('generate-invoices')).toBeDisabled()

    await page.getByTestId('close-week').click()
    await expectToast(page, 'Week closed')

    await expect(page.getByTestId('week-status')).toHaveText(/Closed/)

    // No add buttons any more — each column says the week is closed.
    await expect(page.locator('[data-testid^="add-record-"]')).toHaveCount(0)
    await expect(page.getByTestId(`day-${weekStart(todayIso())}`)).toContainText('Week closed')
    await expect(page.getByTestId('closed-note')).toBeVisible()

    // Record cards lose their edit/delete actions.
    const firstCard = page.locator('[data-testid^="record-"]').first()
    await firstCard.hover()
    await expect(page.locator('[data-testid^="edit-record-"]')).toHaveCount(0)
    await expect(page.locator('[data-testid^="delete-record-"]')).toHaveCount(0)

    // …and generating invoices becomes possible (R9).
    await expect(page.getByTestId('generate-invoices')).toBeEnabled()
    await expect(page.getByTestId('reopen-week')).toBeVisible()
  })

  test('R7 — the API rejects record writes on a closed week with 409 WEEK_CLOSED', async ({ request }) => {
    const week = await currentWeek(request)
    const recordId = (week.days[0].records[0] as { id: number }).id

    await apiCall(request, 'post', `/weeks/${week.id}/close`)

    const created = await apiCall(request, 'post', `/weeks/${week.id}/records`, {
      projectId: 1,
      description: 'Should be rejected',
      hours: 1,
      date: week.startDate,
    })
    expectError(created, 409, 'WEEK_CLOSED')

    const updated = await apiCall(request, 'patch', `/records/${recordId}`, { hours: 1 })
    expectError(updated, 409, 'WEEK_CLOSED')

    const deleted = await apiCall(request, 'delete', `/records/${recordId}`)
    expectError(deleted, 409, 'WEEK_CLOSED')

    // The record is still there.
    const records = await apiCall<{ data: Array<{ id: number }> }>(request, 'get', `/weeks/${week.id}/records`)
    expect(expectEnvelope(records).some(record => record.id === recordId)).toBe(true)
  })

  test('R7 — a week without invoices can be reopened', async ({ page, request }) => {
    const week = await currentWeek(request)

    await gotoApp(page, '/')
    await page.getByTestId('close-week').click()
    await expect(page.getByTestId('week-status')).toHaveText(/Closed/)

    await page.getByTestId('reopen-week').click()
    await expectToast(page, 'Week reopened')
    await expect(page.getByTestId('week-status')).toHaveText(/Open/)
    await expect(page.locator('[data-testid^="add-record-"]')).toHaveCount(7)

    // The API agrees.
    const reopened = await apiCall<{ data: { status: string } }>(request, 'get', `/weeks/${week.id}`)
    expect(expectEnvelope(reopened).status).toBe('open')
  })

  test('R7 — closing an already closed week is refused with 409', async ({ request }) => {
    const week = await currentWeek(request)
    await apiCall(request, 'post', `/weeks/${week.id}/close`)
    const again = await apiCall(request, 'post', `/weeks/${week.id}/close`)
    expectError(again, 409, 'WEEK_CLOSED')
  })
})
