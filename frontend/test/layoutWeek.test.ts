// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Week } from '~/types/api'
import DefaultLayout from '~/layouts/default.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const week: Week = {
  id: 1,
  startDate: '2026-10-19',
  endDate: '2026-10-25',
  status: 'open',
  closedAt: null,
  label: 'Week 43: 19-10-2026 – 25-10-2026',
  isoWeek: 43,
  days: [],
  totals: {
    totalHours: 34.5,
    projectedGross: 4180,
    targetHours: 40,
    belowTarget: true,
    hoursBelowTarget: 5.5,
    clientCount: 2,
    recordCount: 12,
    byProject: [],
    byClient: [],
  },
  invoiceCount: 0,
}

/**
 * GAP-009 regression.
 *
 * The layout's ActiveWeekCard rendered before the week had been fetched, so the
 * server emitted "No active week" while the client rendered "Week 43 Active" —
 * a hydration mismatch on `/` and `/invoices`.
 *
 * The fix fetches the current week during SSR in the layout, so both render
 * the same markup.
 */
describe('GAP-009 — the layout renders the week on the server too', () => {
  beforeEach(() => {
    clearNuxtState()
    document.body.innerHTML = ''
  })

  it('puts the current week into the shared state during SSR', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith('/weeks/current')) {
        return Promise.resolve({ success: true, data: week }) as never
      }
      if (String(url).endsWith('/settings')) {
        return Promise.resolve({
          success: true,
          data: {
            id: 1,
            displayName: 'Alex Morgan',
            weeklyTargetHours: 40,
            currencySymbol: '$',
            invoicePrefix: 'INV',
            updatedAt: '2026-10-22T18:04:11.001Z',
          },
        }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })

    const wrapper = await mountSuspended(DefaultLayout, {
      slots: { default: () => 'page content' },
    })
    await nextTick()

    // The shared week state holds the real week — this is what the card reads.
    const shared = useWeeksState()
    expect(shared.value).not.toBeNull()
    expect(shared.value?.label).toBe('Week 43: 19-10-2026 – 25-10-2026')
    expect(shared.value?.isoWeek).toBe(43)

    wrapper.unmount()
  })

  it('the active week card reads the shared state rather than fetching its own', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith('/weeks/current')) {
        return Promise.resolve({ success: true, data: week }) as never
      }
      if (String(url).endsWith('/settings')) {
        return Promise.resolve({
          success: true,
          data: {
            id: 1,
            displayName: 'Alex Morgan',
            weeklyTargetHours: 40,
            currencySymbol: '$',
            invoicePrefix: 'INV',
            updatedAt: '2026-10-22T18:04:11.001Z',
          },
        }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })

    // Seed the shared state as the SSR fetch would.
    useWeeksState().value = week

    const wrapper = await mountSuspended(DefaultLayout, {
      slots: { default: () => 'page content' },
    })
    await nextTick()

    const card = wrapper.find('[data-testid="active-week-card"]')
    expect(card.exists()).toBe(true)
    // The real label — not the "No active week" placeholder the server used to emit.
    expect(card.text()).toContain('Week 43')
    expect(card.text()).not.toContain('No active week')

    wrapper.unmount()
  })

  /**
   * Regression for the first GAP-009 fix: a `watchEffect` that called
   * `useWeeks()` also tracked the shared useState, so every later change
   * (closing the week, navigating, saving a record) was reverted to the SSR copy.
   */
  it('does not revert later changes to the shared week back to the SSR copy', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith('/weeks/current')) {
        return Promise.resolve({ success: true, data: week }) as never
      }
      return Promise.resolve({ success: true, data: null }) as never
    })

    const wrapper = await mountSuspended(DefaultLayout, {
      slots: { default: () => 'page content' },
    })
    await nextTick()

    const shared = useWeeksState()
    expect(shared.value?.status).toBe('open')

    const closed: Week = { ...week, status: 'closed', closedAt: '2026-10-25T23:59:00.000Z' }
    shared.value = closed
    await nextTick()
    await nextTick()

    expect(shared.value?.status).toBe('closed')

    wrapper.unmount()
  })
})
