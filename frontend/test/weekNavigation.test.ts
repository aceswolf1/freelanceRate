// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Week } from '~/types/api'
import { ApiError } from '~/composables/useApi'
import { useWeekNavigation } from '~/composables/useWeekNavigation'
import { useWeeks, useWeeksState } from '~/composables/useWeeks'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

function apiUrl(path: string): string {
  return `${useRuntimeConfig().public.apiBase as string}${path}`
}

function makeWeek(overrides: Partial<Week> = {}): Week {
  return {
    id: 1,
    startDate: '2026-10-19',
    endDate: '2026-10-25',
    status: 'open',
    closedAt: null,
    label: 'Week 43: 19-10-2026 – 25-10-2026',
    isoWeek: 43,
    days: [],
    totals: {
      totalHours: 0,
      projectedGross: 0,
      targetHours: 40,
      belowTarget: true,
      hoursBelowTarget: 40,
      clientCount: 0,
      recordCount: 0,
      byProject: [],
      byClient: [],
    },
    invoiceCount: 0,
    ...overrides,
  }
}

/**
 * The notifier falls back to `console.warn` / `console.info` when no toast
 * service is mounted, so the app's own messages can be told apart from Vue's
 * own warnings.
 */
function toastLines(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls
    .map(call => String(call[0]))
    .filter(line => line.includes('[toast:'))
}

async function fetchMock() {
  const { $fetch } = await import('#build/fetch')
  const mock = vi.mocked($fetch)
  mock.mockReset()
  return mock
}

describe('useWeekNavigation — prev / next / today', () => {
  beforeEach(async () => {
    clearNuxtState()
    await fetchMock()
  })

  it('asks for the week seven days before the current one', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue({ success: true, data: makeWeek({ id: 42, startDate: '2026-10-12' }) })
    useWeeksState().value = makeWeek()
    const { goPrevious } = useWeekNavigation()

    await goPrevious()

    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/by-date/2026-10-12'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('asks for the week seven days after the current one', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue({ success: true, data: makeWeek({ id: 44, startDate: '2026-10-26' }) })
    useWeeksState().value = makeWeek()
    const { goNext } = useWeekNavigation()

    await goNext()

    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/by-date/2026-10-26'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('does nothing when there is no week to navigate from', async () => {
    const mock = await fetchMock()
    const { goPrevious, goNext, week } = useWeekNavigation()

    expect(await goPrevious()).toBeNull()
    expect(await goNext()).toBeNull()
    expect(week.value).toBeNull()
    expect(mock).not.toHaveBeenCalled()
  })

  it('returns to today by forcing a fresh read of the current week', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue({ success: true, data: makeWeek() })
    const { load } = useWeeks()
    await load()
    mock.mockClear()

    const { goToToday } = useWeekNavigation()
    await goToToday()

    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/current'),
      expect.objectContaining({ method: 'GET' }),
    )
  })
})

describe('useWeekNavigation — closing and reopening a week (R7)', () => {
  beforeEach(async () => {
    clearNuxtState()
    await fetchMock()
  })

  it('closes an open week and confirms it', async () => {
    const mock = await fetchMock()
    mock.mockImplementation((url: string) => {
      if (String(url).endsWith('/weeks/1/close')) {
        return Promise.resolve({ success: true, data: null }) as never
      }
      return Promise.resolve({ success: true, data: makeWeek({ status: 'closed' }) }) as never
    })
    useWeeksState().value = makeWeek({ status: 'open' })
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { toggleClosed } = useWeekNavigation()

    const next = await toggleClosed()

    expect(next?.status).toBe('closed')
    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/1/close'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(toastLines(info).some(line => line.includes('Week closed'))).toBe(true)

    info.mockRestore()
    warn.mockRestore()
  })

  it('reopens a closed week and confirms it', async () => {
    const mock = await fetchMock()
    mock.mockImplementation((url: string) => {
      if (String(url).endsWith('/weeks/1/reopen')) {
        return Promise.resolve({ success: true, data: null }) as never
      }
      return Promise.resolve({ success: true, data: makeWeek({ status: 'open' }) }) as never
    })
    useWeeksState().value = makeWeek({ status: 'closed' })
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { toggleClosed } = useWeekNavigation()

    const next = await toggleClosed()

    expect(next?.status).toBe('open')
    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/1/reopen'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(toastLines(info).some(line => line.includes('Week reopened'))).toBe(true)

    info.mockRestore()
    warn.mockRestore()
  })

  it('explains a 409 calmly and keeps the week as it was', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new ApiError({ code: 'CONFLICT', message: 'invoices already exist' }, 409))
    useWeeksState().value = makeWeek({ status: 'open' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { toggleClosed, week } = useWeekNavigation()

    const next = await toggleClosed()

    expect(next?.status).toBe('open')
    expect(week.value?.status).toBe('open')
    expect(toastLines(warn).some(line => line.includes('Cannot change the week status'))).toBe(true)
    expect(toastLines(warn).some(line => line.includes('invoices already exist'))).toBe(true)

    warn.mockRestore()
  })

  it('treats WEEK_CLOSED as a calm conflict too', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new ApiError({ code: 'WEEK_CLOSED', message: 'week is closed' }, 409))
    useWeeksState().value = makeWeek({ status: 'open' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { toggleClosed } = useWeekNavigation()

    await toggleClosed()

    expect(toastLines(warn).some(line => line.includes('Cannot change the week status'))).toBe(true)

    warn.mockRestore()
  })

  it('reports an unexpected failure as an error and keeps the week', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new ApiError({ code: 'INTERNAL', message: 'database exploded' }, 500))
    useWeeksState().value = makeWeek({ status: 'open' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { toggleClosed, week } = useWeekNavigation()

    const next = await toggleClosed()

    expect(next?.status).toBe('open')
    expect(week.value?.status).toBe('open')
    expect(toastLines(warn).some(line => line.includes('Unexpected error'))).toBe(true)

    warn.mockRestore()
  })

  it('does nothing when there is no week to close', async () => {
    const mock = await fetchMock()
    const { toggleClosed, week } = useWeekNavigation()

    expect(await toggleClosed()).toBeNull()
    expect(week.value).toBeNull()
    expect(mock).not.toHaveBeenCalled()
  })
})
