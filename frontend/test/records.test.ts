// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Week, WorkRecord } from '~/types/api'
import { ApiError } from '~/composables/useApi'
import { isWeekClosedError } from '~/composables/useRecords'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

function makeRecord(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: 1,
    weekId: 7,
    projectId: 1,
    project: { id: 1, name: 'Storefront', clientId: 1 },
    clientId: 1,
    client: { id: 1, name: 'Acme', contactEmail: 'a@b.example', ccEmail: null, billingHour: 130 },
    description: 'work',
    hours: 3.5,
    date: '2026-10-19',
    rate: 130,
    lineTotal: 455,
    createdAt: '2026-10-22T18:04:11.120Z',
    updatedAt: '2026-10-22T18:04:11.120Z',
    ...overrides,
  }
}

function makeWeek(status: 'open' | 'closed' = 'open'): Week {
  return {
    id: 7,
    startDate: '2026-10-19',
    endDate: '2026-10-25',
    status,
    closedAt: null,
    label: 'Week 43: 19-10-2026 – 25-10-2026',
    isoWeek: 43,
    days: [{
      date: '2026-10-19',
      dayName: 'Mon',
      dayOfWeek: 1,
      isWeekend: false,
      hours: 3.5,
      projectedGross: 455,
      records: [makeRecord()],
    }],
    totals: {
      totalHours: 3.5,
      projectedGross: 455,
      targetHours: 40,
      belowTarget: true,
      hoursBelowTarget: 36.5,
      clientCount: 1,
      recordCount: 1,
      byProject: [],
      byClient: [],
    },
    invoiceCount: 0,
  }
}

const ok = <T>(data: T) => ({ success: true, data })

describe('useRecords', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  /** Derived from runtimeConfig so the assertions survive a port change. */
  let base: string

  beforeEach(async () => {
    clearNuxtState()
    base = useRuntimeConfig().public.apiBase as string
    const { $fetch } = await import('#build/fetch')
    fetchMock = vi.mocked($fetch)
    fetchMock.mockReset()
    useWeeks().set(makeWeek())
  })

  it('POSTs to /weeks/:id/records then refreshes the week so totals stay true', async () => {
    fetchMock.mockResolvedValue(ok(makeWeek()))
    const { create } = useRecords()

    await create(7, { projectId: 1, description: 'work', hours: 3.5, date: '2026-10-19' })

    expect(fetchMock.mock.calls[0]![0]).toBe(`${base}/weeks/7/records`)
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[1]![0]).toBe(`${base}/weeks/7`)
  })

  it('PATCHes /records/:id on edit', async () => {
    fetchMock.mockResolvedValue(ok(makeWeek()))
    const { update } = useRecords()

    await update(1, { hours: 6 })

    expect(fetchMock.mock.calls[0]![0]).toBe(`${base}/records/1`)
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'PATCH', body: { hours: 6 } })
  })

  it('DELETEs /records/:id then refreshes', async () => {
    fetchMock.mockResolvedValue(ok({ id: 1, deleted: true }))
    fetchMock.mockResolvedValueOnce(ok({ id: 1, deleted: true }))
    fetchMock.mockResolvedValueOnce(ok(makeWeek()))
    const { remove } = useRecords()

    await remove(1)

    expect(fetchMock.mock.calls[0]![0]).toBe(`${base}/records/1`)
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' })
    expect(fetchMock.mock.calls[1]![0]).toBe(`${base}/weeks/7`)
  })

  it('surfaces WEEK_CLOSED rather than pretending the write succeeded', async () => {
    fetchMock.mockRejectedValue(new ApiError({ code: 'WEEK_CLOSED', message: 'Week 43 is closed' }, 409))
    const { create } = useRecords()

    const error = await create(7, { projectId: 1, description: 'x', hours: 1, date: '2026-10-19' })
      .catch((e: unknown) => e)

    expect(isWeekClosedError(error)).toBe(true)
  })

  it('surfaces a date-outside-week VALIDATION_ERROR with the field path', async () => {
    fetchMock.mockRejectedValue(new ApiError(
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid payload',
        details: [{ path: 'date', message: 'Date 2026-10-26 is outside week 43' }],
      },
      400,
    ))
    const { create } = useRecords()

    try {
      await create(7, { projectId: 1, description: 'x', hours: 1, date: '2026-10-26' })
      throw new Error('should have thrown')
    }
    catch (error) {
      expect((error as ApiError).fieldErrors.date).toContain('outside week 43')
    }
  })

  it('does not leak a record write into the toast layer (the drawer renders it inline)', async () => {
    fetchMock.mockRejectedValue(new ApiError({ code: 'WEEK_CLOSED', message: 'Week 43 is closed' }, 409))
    const { create } = useRecords()

    // useRecords does not call notifier.error itself; the drawer does.
    await expect(create(7, { projectId: 1, description: 'x', hours: 1, date: '2026-10-19' }))
      .rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})