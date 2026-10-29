// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Week } from '~/types/api'
import { ApiError } from '~/composables/useApi'
import { useActiveWeek, useWeeks, useWeeksState } from '~/composables/useWeeks'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

/**
 * The API base is environment-driven (`NUXT_PUBLIC_API_BASE`), so expectations
 * are built from the running config rather than hardcoding a path prefix.
 */
function apiUrl(path: string): string {
  return `${useRuntimeConfig().public.apiBase as string}${path}`
}

function makeDay(date: string, dayName: string, dayOfWeek: number): Week['days'][number] {
  return {
    date,
    dayName,
    dayOfWeek,
    isWeekend: dayOfWeek >= 6,
    hours: 0,
    projectedGross: 0,
    records: [],
  }
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
    days: [
      makeDay('2026-10-19', 'Mon', 1),
      makeDay('2026-10-20', 'Tue', 2),
      makeDay('2026-10-21', 'Wed', 3),
      makeDay('2026-10-22', 'Thu', 4),
      makeDay('2026-10-23', 'Fri', 5),
      makeDay('2026-10-24', 'Sat', 6),
      makeDay('2026-10-25', 'Sun', 7),
    ],
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
    ...overrides,
  }
}

const ok = <T>(data: T) => ({ success: true, data })

/**
 * The notifier falls back to `console.warn` when no toast service is mounted,
 * so the app's own messages can be told apart from Vue's own warnings.
 */
function toastLines(warn: ReturnType<typeof vi.spyOn>): string[] {
  return warn.mock.calls
    .map(call => String(call[0]))
    .filter(line => line.includes('[toast:'))
}

async function fetchMock() {
  const { $fetch } = await import('#build/fetch')
  const mock = vi.mocked($fetch)
  mock.mockReset()
  return mock
}

describe('useWeeks — loading the current week', () => {
  beforeEach(async () => {
    clearNuxtState()
    await fetchMock()
  })

  it('reads GET /weeks/current and stores the week', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue(ok(makeWeek()))
    const { load, week, loaded } = useWeeks()

    await load()

    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/current'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(week.value?.label).toBe('Week 43: 19-10-2026 – 25-10-2026')
    expect(loaded.value).toBe(true)
  })

  it('does not refetch once the week is loaded', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue(ok(makeWeek()))
    const { load } = useWeeks()

    await load()
    await load()

    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('refetches when forced — "back to today" needs fresh data', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue(ok(makeWeek()))
    const { load } = useWeeks()

    await load()
    await load({ force: true })

    expect(mock).toHaveBeenCalledTimes(2)
  })

  it('does not start a second request while one is still in flight', async () => {
    const mock = await fetchMock()
    let release: (value: unknown) => void = () => {}
    mock.mockImplementation(() => new Promise((resolve) => { release = resolve }) as never)
    const { load, pending } = useWeeks()

    const first = load()
    expect(pending.value).toBe(true)
    await load()

    expect(mock).toHaveBeenCalledTimes(1)

    release(ok(makeWeek()))
    await first
    expect(pending.value).toBe(false)
  })

  it('keeps the placeholder and tells the user when the API is down', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new Error('connection refused'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { load, week, pending } = useWeeks()

    await load()

    expect(week.value).toBeNull()
    expect(pending.value).toBe(false)
    expect(toastLines(warn).some(line => line.includes('Could not load the current week'))).toBe(true)

    warn.mockRestore()
  })

  it('stays quiet on 404 — the weeks module may simply not be mounted', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new ApiError({ code: 'NOT_FOUND', message: 'no weeks' }, 404))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { load, week } = useWeeks()

    await load()

    expect(week.value).toBeNull()
    expect(toastLines(warn)).toEqual([])

    warn.mockRestore()
  })

  it('suppresses the message when the caller asked for a silent load', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new Error('connection refused'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { load } = useWeeks()

    await load({ silent: true })

    expect(toastLines(warn)).toEqual([])

    warn.mockRestore()
  })
})

describe('useWeeks — loading by date and by id', () => {
  beforeEach(async () => {
    clearNuxtState()
    await fetchMock()
  })

  it('asks for the week containing a date (get-or-create, §3.6)', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue(ok(makeWeek()))
    const { loadByDate, week } = useWeeks()

    await loadByDate('2026-10-26')

    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/by-date/2026-10-26'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(week.value?.id).toBe(1)
  })

  it('clears the week when the date cannot be resolved', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue(ok(makeWeek()))
    const { loadByDate, week } = useWeeks()
    await loadByDate('2026-10-26')

    mock.mockRejectedValue(new Error('boom'))
    await loadByDate('2026-11-02')

    expect(week.value).toBeNull()
  })

  it('reads a week by its id', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue(ok(makeWeek({ id: 7 })))
    const { loadById, week } = useWeeks()

    await loadById(7)

    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/7'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(week.value?.id).toBe(7)
  })

  it('clears the week when the id is unknown', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new ApiError({ code: 'NOT_FOUND', message: 'no such week' }, 404))
    const { loadById, week } = useWeeks()

    await loadById(999)

    expect(week.value).toBeNull()
  })
})

describe('useWeeks — closing and reopening', () => {
  beforeEach(async () => {
    clearNuxtState()
    await fetchMock()
  })

  it('posts the close command and re-reads the week', async () => {
    const mock = await fetchMock()
    mock.mockImplementation((url: string) => {
      if (String(url).endsWith('/weeks/1/close')) {
        return Promise.resolve(ok(null)) as never
      }
      return Promise.resolve(ok(makeWeek({ status: 'closed', closedAt: '2026-10-25T23:59:00.000Z' }))) as never
    })
    const { close, week } = useWeeks()

    await close(1)

    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/1/close'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(week.value?.status).toBe('closed')
  })

  it('posts the reopen command and re-reads the week', async () => {
    const mock = await fetchMock()
    mock.mockImplementation((url: string) => {
      if (String(url).endsWith('/weeks/1/reopen')) {
        return Promise.resolve(ok(null)) as never
      }
      return Promise.resolve(ok(makeWeek({ status: 'open' }))) as never
    })
    const { reopen, week } = useWeeks()

    await reopen(1)

    expect(mock).toHaveBeenCalledWith(
      apiUrl('/weeks/1/reopen'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(week.value?.status).toBe('open')
  })
})

describe('useWeeks — shared state helpers', () => {
  beforeEach(async () => {
    clearNuxtState()
    await fetchMock()
  })

  it('adopts a locally-mutated week without a refetch', async () => {
    const mock = await fetchMock()
    const { set, week, loaded } = useWeeks()

    set(makeWeek({ id: 42 }))

    expect(week.value?.id).toBe(42)
    expect(loaded.value).toBe(true)
    expect(mock).not.toHaveBeenCalled()
  })

  it('clears the loaded flag when the week is dropped', () => {
    const { set, week, loaded } = useWeeks()
    set(makeWeek())

    set(null)

    expect(week.value).toBeNull()
    expect(loaded.value).toBe(false)
  })

  it('hydrates only when nothing has been loaded yet', () => {
    const { hydrate, week, loaded } = useWeeks()

    hydrate(makeWeek({ id: 5 }))
    expect(week.value?.id).toBe(5)
    expect(loaded.value).toBe(true)

    // A later hydration must not overwrite fresher client-side state.
    hydrate(makeWeek({ id: 6 }))
    expect(week.value?.id).toBe(5)
  })

  it('exposes the shared state as one ref for every caller', () => {
    const { set } = useWeeks()
    set(makeWeek({ id: 9 }))

    expect(useWeeksState().value?.id).toBe(9)
  })

  it('derives isOpen and totals from the current week', () => {
    const { set, isOpen, totals } = useWeeks()

    expect(isOpen.value).toBe(false)
    expect(totals.value).toBeNull()

    set(makeWeek({ status: 'open' }))
    expect(isOpen.value).toBe(true)
    expect(totals.value?.totalHours).toBe(34.5)

    set(makeWeek({ status: 'closed' }))
    expect(isOpen.value).toBe(false)
  })

  it('exposes useActiveWeek as an alias of useWeeks', () => {
    const { set, week } = useActiveWeek()

    set(makeWeek({ id: 11 }))

    expect(week.value?.id).toBe(11)
  })
})
