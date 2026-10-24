// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EarningsReport } from '~/types/api'
import { ApiError } from '~/composables/useApi'
import {
  daysInMonth,
  isRangeInvalid,
  isoToLocalDate,
  localDateToIso,
  rangeForPreset,
} from '~/composables/useEarnings'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

/**
 * The API base is environment-driven (`NUXT_PUBLIC_API_BASE`), so expectations
 * are built from the running config rather than hardcoding a port.
 */
function apiUrl(path: string): string {
  return `${useRuntimeConfig().public.apiBase as string}${path}`
}

const ok = <T>(data: T) => ({ success: true, data })

/** Contract §4.8 worked example, plus the §8.1 additive `unbilled` block. */
function makeReport(overrides: Partial<EarningsReport> = {}): EarningsReport {
  return {
    from: '2026-10-19',
    to: '2026-10-24',
    groupBy: 'project',
    currencySymbol: '$',
    rows: [
      { id: 1, name: 'E-Commerce Storefront', hours: 15.5, gross: 2015, fees: 20.15, net: 1994.85 },
      { id: 3, name: 'Video Streaming Mobile App', hours: 14.5, gross: 1667.5, fees: 16.68, net: 1650.82 },
      { id: 4, name: 'Internal Tools', hours: 2.5, gross: 237.5, fees: 0, net: 237.5 },
    ],
    totals: { hours: 32.5, gross: 3920, fees: 36.83, net: 3883.17 },
    unbilled: { hours: 32.5, gross: 3920, fees: 36.83, net: 3883.17, weekCount: 1 },
    ...overrides,
  }
}

describe('rangeForPreset', () => {
  const today = new Date(Date.UTC(2026, 9, 23)) // Fri 23-10-2026

  it('resolves "This week" to Monday–Sunday, matching the backend week (Mon–Sun)', () => {
    expect(rangeForPreset('week', today)).toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })

  it('handles a Monday without shifting the window', () => {
    expect(rangeForPreset('week', new Date(Date.UTC(2026, 9, 19))))
      .toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })

  it('handles a Sunday — still the week it belongs to', () => {
    expect(rangeForPreset('week', new Date(Date.UTC(2026, 9, 25))))
      .toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })

  it('resolves "This month" to the first and last day', () => {
    expect(rangeForPreset('month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('resolves "This month" in a leap February', () => {
    expect(rangeForPreset('month', new Date(Date.UTC(2024, 1, 10)))).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('resolves "This year" to the full calendar year', () => {
    expect(rangeForPreset('year', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('sends no bounds for "All time" so the API applies its own defaults (§4.8)', () => {
    expect(rangeForPreset('all', today)).toEqual({ from: '', to: '' })
  })

  it('knows month lengths', () => {
    expect(daysInMonth(2026, 0)).toBe(31)
    expect(daysInMonth(2026, 1)).toBe(28)
    expect(daysInMonth(2024, 1)).toBe(29)
    expect(daysInMonth(2026, 3)).toBe(30)
  })
})

describe('date <-> iso conversion', () => {
  it('round-trips an ISO date without shifting a day (no timezone drift)', () => {
    const date = isoToLocalDate('2026-10-19')
    expect(date).not.toBeNull()
    expect(localDateToIso(date)).toBe('2026-10-19')
  })

  it('round-trips a leap day', () => {
    expect(localDateToIso(isoToLocalDate('2024-02-29'))).toBe('2024-02-29')
  })

  it('rejects malformed input instead of guessing', () => {
    expect(isoToLocalDate('19-10-2026')).toBeNull()
    expect(isoToLocalDate('')).toBeNull()
    expect(localDateToIso(null)).toBe('')
  })
})

describe('isRangeInvalid', () => {
  it('accepts a well-ordered range', () => {
    expect(isRangeInvalid({ from: '2026-10-01', to: '2026-10-31' })).toBe(false)
  })

  it('accepts an open-ended range', () => {
    expect(isRangeInvalid({ from: '2026-10-01', to: '' })).toBe(false)
    expect(isRangeInvalid({ from: '', to: '' })).toBe(false)
  })

  it('rejects from after to — the contract VALIDATION_ERROR case (§4.8)', () => {
    expect(isRangeInvalid({ from: '2026-10-31', to: '2026-10-01' })).toBe(true)
  })
})

describe('useEarnings', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    clearNuxtState()
    const { $fetch } = await import('#build/fetch')
    fetchMock = vi.mocked($fetch)
    fetchMock.mockReset()
  })

  it('loads the report grouped by project by default', async () => {
    fetchMock.mockResolvedValue(ok(makeReport()))
    const { load, rows, totals, isEmpty } = useEarnings()

    await load()

    expect(fetchMock).toHaveBeenCalledWith(
      apiUrl('/reports/earnings'),
      expect.objectContaining({
        method: 'GET',
        query: { groupBy: 'project' },
      }),
    )
    expect(rows.value).toHaveLength(3)
    expect(totals.value.gross).toBe(3920)
    expect(isEmpty.value).toBe(false)
  })

  it('re-queries by client when the grouping changes', async () => {
    fetchMock.mockResolvedValue(ok(makeReport({ groupBy: 'client' })))
    const { load, setGroupBy, groupBy } = useEarnings()
    await load()

    fetchMock.mockResolvedValue(ok(makeReport({
      groupBy: 'client',
      rows: [{ id: 1, name: 'Acme Corp', hours: 17.5, gross: 2275, fees: 22.75, net: 2252.25 }],
    })))
    await setGroupBy('client')

    expect(groupBy.value).toBe('client')
    expect(fetchMock).toHaveBeenLastCalledWith(
      apiUrl('/reports/earnings'),
      expect.objectContaining({ query: { groupBy: 'client' } }),
    )
  })

  it('is a no-op when the grouping did not actually change', async () => {
    fetchMock.mockResolvedValue(ok(makeReport()))
    const { load, setGroupBy } = useEarnings()
    await load()

    await setGroupBy('project')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('applies a preset as both query bounds', async () => {
    fetchMock.mockResolvedValue(ok(makeReport()))
    const { load, applyPreset, from, to, preset } = useEarnings()
    await load()

    fetchMock.mockClear()
    await applyPreset('year')

    expect(from.value).toBe('2026-01-01')
    expect(to.value).toBe('2026-12-31')
    expect(preset.value).toBe('year')
    expect(fetchMock).toHaveBeenLastCalledWith(
      apiUrl('/reports/earnings'),
      expect.objectContaining({ query: { groupBy: 'project', from: '2026-01-01', to: '2026-12-31' } }),
    )
  })

  it('omits the bounds entirely for "All time"', async () => {
    fetchMock.mockResolvedValue(ok(makeReport()))
    const { applyPreset } = useEarnings()

    await applyPreset('all')

    expect(fetchMock).toHaveBeenCalledWith(
      apiUrl('/reports/earnings'),
      expect.objectContaining({ query: { groupBy: 'project' } }),
    )
  })

  it('drops the preset chip when the range is edited by hand', async () => {
    fetchMock.mockResolvedValue(ok(makeReport()))
    const { load, applyPreset, setRange, preset } = useEarnings()
    await load()
    await applyPreset('year')

    await setRange({ from: '2026-01-05', to: '2026-02-28' })

    expect(preset.value).toBeNull()
  })

  it('refuses to fetch an inverted range and flags it inline', async () => {
    fetchMock.mockResolvedValue(ok(makeReport()))
    const { from, to, load, invalidRange } = useEarnings()
    from.value = '2026-10-31'
    to.value = '2026-10-01'

    expect(invalidRange.value).toBe(true)
    await load()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exposes the §8.1 unbilled block and hides it when nothing is uninvoiced', async () => {
    fetchMock.mockResolvedValue(ok(makeReport()))
    const { load, unbilled, hasUnbilled } = useEarnings()

    await load()

    expect(unbilled.value.weekCount).toBe(1)
    expect(unbilled.value.gross).toBe(3920)
    expect(hasUnbilled.value).toBe(true)

    fetchMock.mockResolvedValue(ok(makeReport({ unbilled: { hours: 0, gross: 0, fees: 0, net: 0, weekCount: 0 } })))
    await load({ force: true })

    expect(hasUnbilled.value).toBe(false)
  })

  it('falls back to the API-resolved range when no explicit range is set', async () => {
    fetchMock.mockResolvedValue(ok(makeReport()))
    const { load, effectiveRange } = useEarnings()

    await load()

    expect(effectiveRange.value).toEqual({ from: '2026-10-19', to: '2026-10-24' })
  })

  it('reports an empty range rather than throwing', async () => {
    fetchMock.mockResolvedValue(ok(makeReport({ rows: [], totals: { hours: 0, gross: 0, fees: 0, net: 0 } })))
    const { load, isEmpty, rows } = useEarnings()

    await load()

    expect(isEmpty.value).toBe(true)
    expect(rows.value).toEqual([])
  })

  it('propagates an API error so the page can surface it', async () => {
    fetchMock.mockRejectedValue(new ApiError({ code: 'VALIDATION_ERROR', message: 'from must be before to' }, 400))
    const { load } = useEarnings()

    await expect(load()).rejects.toBeInstanceOf(ApiError)
  })
})