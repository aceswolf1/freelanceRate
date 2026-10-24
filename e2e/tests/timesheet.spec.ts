/**
 * Weekly timesheet — R4 (weeks + navigation), R5 (work records), R6 (calendar UI),
 * R8 (below-target warning).
 *
 * The suite drives the real UI against the real API. The database is re-seeded
 * before every test so each scenario starts from the known dataset
 * (Acme Corp $130/h, Starlight Media $100/h, Internal Tools standalone $95/h,
 * current Mon–Sun week carrying 34.5 h).
 *
 * GAP-001 (frontend timesheet & CRUD) — FOUND BY THIS SUITE, FIXED BY worker-2:
 *   Opening the quick-add drawer used to put the page into an infinite reactive
 *   loop (`watch(() => request.value.token, …)` → `openDrawer()` → `open()` bumps
 *   the token again), so the browser tab froze and the drawer never appeared.
 *   The specs below now assert the corrected behaviour end to end.
 */
import { expect, test } from '@playwright/test'
import { apiCall, currentWeek, expectEnvelope, expectError } from '../helpers/api'
import { addDays, formatDisplayDate, isoWeekNumber, localTodayIso, todayIso, weekDays, weekEnd, weekStart, weekTitle } from '../helpers/dates'
import { seedDatabase } from '../helpers/servers'
import { expectToast, fieldInput, fieldTextarea, fillNumber, gotoApp, numberInput, selectOption, visibleOptionTexts } from '../helpers/ui'

const CLIENT_SELECT = 'record-client-select'
const PROJECT_SELECT = 'record-project-select'

test.describe('Weekly timesheet', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('R4 — shows the current week title and seven Mon–Sun day columns', async ({ page }) => {
    await gotoApp(page, '/')

    const start = weekStart(todayIso())
    const expectedTitle = `Week ${isoWeekNumber(start)}: ${formatDisplayDate(start)} – ${formatDisplayDate(weekEnd(start))}`

    await expect(page.getByTestId('week-label')).toHaveText(expectedTitle)
    await expect(page.getByTestId('week-status')).toHaveText(/Open/)

    const columns = page.locator('[data-testid^="day-2"]')
    await expect(columns).toHaveCount(7)

    const labels = await columns.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    expect(labels).toEqual(weekDays(start).map((date, index) => `${dayNames[index]} ${formatDisplayDate(date)}`))
  })

  test('R6 — Saturday and Sunday are muted but still offer the add affordance', async ({ page }) => {
    await gotoApp(page, '/')

    const start = weekStart(todayIso())
    const saturday = weekDays(start)[5]
    const sunday = weekDays(start)[6]

    for (const date of [saturday, sunday]) {
      const column = page.getByTestId(`day-${date}`)
      await expect(column).toHaveAttribute('data-weekend', 'true')
      await expect(column).toContainText('Weekend')

      const addButton = page.getByTestId(`add-record-${date}`)
      await expect(addButton).toBeVisible()
      await expect(addButton).toBeEnabled()
    }
  })

  // GAP-001 (fixed by worker-2) — the quick-add drawer used to freeze the tab.
  test('R6 — clicking "Log Weekend" opens the drawer on that weekend date', async ({ page }) => {
    await gotoApp(page, '/')
    const saturday = weekDays(weekStart(todayIso()))[5]

    await page.getByTestId(`add-record-${saturday}`).click({ timeout: 8000 })
    await expect(page.getByTestId('record-hours')).toBeVisible({ timeout: 8000 })
    await expect(fieldInput(page, 'record-date')).toHaveValue(saturday)
    await expect(page.getByTestId('drawer-day-label')).toContainText(formatDisplayDate(saturday))
  })

  // GAP-001 (fixed by worker-2) — the quick-add drawer used to freeze the tab.
  test('R5/R6 — adds a record through the drawer and updates the totals', async ({ page }) => {
    await gotoApp(page, '/')

    const start = weekStart(todayIso())
    const monday = weekDays(start)[0]

    await expect(page.getByTestId('summary-hours')).toHaveText('34.5h')

    await page.getByTestId(`add-record-${monday}`).click({ timeout: 8000 })
    await expect(page.getByTestId('record-hours')).toBeVisible({ timeout: 8000 })

    // Client → project filtering (R6: the drawer filters projects by client).
    await selectOption(page, CLIENT_SELECT, /^Acme Corp/)
    await selectOption(page, PROJECT_SELECT, /^E-Commerce Storefront/)

    // Only Acme's projects are offered.
    const projectOptions = await visibleOptionTexts(page)
    expect(projectOptions.join('|')).toContain('E-Commerce Storefront')
    expect(projectOptions.join('|')).toContain('API Microservice')
    expect(projectOptions.join('|')).not.toContain('Video Streaming Mobile App')
    expect(projectOptions.join('|')).not.toContain('Internal Tools')

    // Rate badge — see the dedicated GAP-002 spec (PrimeVue's FormField shadows
    // the app's, so the badge slot never renders).

    await fillNumber(page, 'record-hours', '5.5')
    await expect(page.getByTestId('estimated-total')).toContainText('$715.00')

    await fieldTextarea(page, 'record-description').fill('QA — regression pass on the checkout flow')
    await page.getByTestId('drawer-save').click()

    await expectToast(page, 'Record saved')

    // Totals update: 34.5 h + 5.5 h = 40.0 h
    await expect(page.getByTestId('summary-hours')).toHaveText('40.0h')
    await expect(page.getByTestId('summary-gross')).toContainText('$4895.00')

    // The new entry shows up inside the Monday column.
    await expect(page.getByTestId(`day-${monday}`)).toContainText('QA — regression pass on the checkout flow')
  })

  // GAP-001 (fixed by worker-2) — opening the drawer for an existing record used to freeze the tab.
  // GAP-002 (found here, fixed by worker-2) — the rate badge lives in the
  // FormField `label-extra` slot, which PrimeVue's shadowing FormField never
  // rendered. The badge must be back now.
  test('R6 — the drawer shows the effective rate badge', async ({ page }) => {
    await gotoApp(page, '/')
    const monday = weekDays(weekStart(todayIso()))[0]

    await page.getByTestId(`add-record-${monday}`).click({ timeout: 8000 })
    await expect(page.getByTestId('record-hours')).toBeVisible({ timeout: 8000 })
    await selectOption(page, CLIENT_SELECT, /^Acme Corp/)
    await selectOption(page, PROJECT_SELECT, /^E-Commerce Storefront/)

    await expect(page.getByTestId('rate-badge')).toHaveText(/Rate: \$130\.00\/hr/)
  })

  // GAP-004 (found here, fixed by worker-2) — the edit drawer used to drop the
  // record's project, so the project select came up empty and the save was
  // blocked. The corrected behaviour is asserted again below.
  test('R5 — the edit drawer prefills the project and saves the change', async ({ page, request }) => {
    await gotoApp(page, '/')

    const week = await currentWeek(request)
    const monday = week.days[0]
    const recordId = (monday.records[0] as { id: number }).id

    await page.getByTestId(`record-${recordId}`).hover()
    await page.getByTestId(`edit-record-${recordId}`).click({ timeout: 8000 })
    await expect(page.getByTestId('record-hours')).toBeVisible({ timeout: 8000 })

    // The project must be prefilled with the record's project.
    await expect(page.getByTestId('record-project-select')).toContainText('E-Commerce Storefront')

    await fillNumber(page, 'record-hours', '2')
    await page.getByTestId('drawer-save').click()

    await expectToast(page, 'Record saved')

    // 34.5 h − 1.5 h = 33.0 h
    await expect(page.getByTestId('summary-hours')).toHaveText('33.0h')
  })

  test('R5 — an edited record is saved once the project is chosen again', async ({ page, request }) => {
    await gotoApp(page, '/')

    const week = await currentWeek(request)
    const monday = week.days[0]
    const recordId = (monday.records[0] as { id: number }).id

    await page.getByTestId(`record-${recordId}`).hover()
    await page.getByTestId(`edit-record-${recordId}`).click({ timeout: 8000 })
    await expect(page.getByTestId('record-hours')).toBeVisible({ timeout: 8000 })
    await expect(numberInput(page, 'record-hours')).toHaveValue(/3\.5/)

    // The project comes prefilled (GAP-004 fixed) — picking it again is harmless.
    await selectOption(page, PROJECT_SELECT, /^E-Commerce Storefront/)

    await fillNumber(page, 'record-hours', '2')
    await page.getByTestId('drawer-save').click()

    await expectToast(page, 'Record saved')

    // 34.5 h − 1.5 h = 33.0 h
    await expect(page.getByTestId('summary-hours')).toHaveText('33.0h')
  })

  // GAP-010 (resolved) — "today" is derived from the local calendar date,
  // matching the backend and the user's clock.
  test('R4 — the today marker follows the local date', async ({ page }) => {
    await gotoApp(page, '/')
    const localToday = localTodayIso()
    await expect(page.getByTestId(`day-${localToday}`).getByTestId('today-dot')).toBeVisible()
  })

  test('R5 — deletes a record', async ({ page, request }) => {
    await gotoApp(page, '/')

    const week = await currentWeek(request)
    const monday = week.days[0]
    const recordId = (monday.records[0] as { id: number }).id

    // The card actions are revealed on hover.
    await page.getByTestId(`record-${recordId}`).hover()
    await page.getByTestId(`delete-record-${recordId}`).click()

    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expectToast(page, 'Record deleted')
    await expect(page.getByTestId('summary-hours')).toHaveText('31.0h')

    const remaining = await apiCall(request, 'get', `/weeks/${week.id}/records`)
    expectEnvelope(remaining)
    const ids = (remaining.json as { data: Array<{ id: number }> }).data.map(record => record.id)
    expect(ids).not.toContain(recordId)
  })

  test('R5 — creates, updates and deletes a record through the API', async ({ request }) => {
    const week = await currentWeek(request)

    const created = await apiCall<{ data: { id: number, hours: number, clientId: number | null } }>(
      request,
      'post',
      `/weeks/${week.id}/records`,
      { projectId: 1, description: 'QA API record', hours: 5.5, date: week.startDate },
    )
    const record = expectEnvelope(created, 201)
    expect(record.hours).toBe(5.5)
    expect(record.clientId).toBe(1)

    const updated = await apiCall<{ data: { hours: number } }>(
      request,
      'patch',
      `/records/${record.id}`,
      { hours: 2 },
    )
    expect(expectEnvelope(updated).hours).toBe(2)

    const deleted = await apiCall(request, 'delete', `/records/${record.id}`)
    expectEnvelope(deleted)
  })

  test('R8 — shows the below-target warning without blocking logging', async ({ page }) => {
    await gotoApp(page, '/')

    const banner = page.getByTestId('target-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toHaveAttribute('data-below-target', 'true')
    await expect(banner).toContainText('34.5 / 40.0 hrs logged this week')
    await expect(page.getByTestId('below-target-badge')).toHaveText('-5.5 hrs below target')

    // Informational only — the add affordance is still there.
    await expect(page.getByTestId(`add-record-${weekStart(todayIso())}`)).toBeEnabled()
  })

  test('R4 — navigates to the previous and next week', async ({ page }) => {
    await gotoApp(page, '/')

    const start = weekStart(todayIso())
    await expect(page.getByTestId('week-label')).toHaveText(weekTitle(start))

    await page.getByTestId('prev-week').click()
    await expect(page.getByTestId('week-label')).toHaveText(weekTitle(addDays(start, -7)))

    await page.getByTestId('next-week').click()
    await expect(page.getByTestId('week-label')).toHaveText(weekTitle(start))

    await page.getByTestId('next-week').click()
    await expect(page.getByTestId('week-label')).toHaveText(weekTitle(addDays(start, 7)))

    await page.getByTestId('today-button').click()
    await expect(page.getByTestId('week-label')).toHaveText(weekTitle(start))
  })

  test('R5 — rejects a record whose date is outside the week', async ({ request }) => {
    const week = await currentWeek(request)
    const outside = addDays(week.endDate, 1)

    const result = await apiCall(request, 'post', `/weeks/${week.id}/records`, {
      projectId: 1,
      description: 'Outside the week',
      hours: 1,
      date: outside,
    })

    expectError(result, 400, 'VALIDATION_ERROR')
  })
})
