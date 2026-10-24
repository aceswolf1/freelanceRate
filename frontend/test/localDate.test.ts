// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { todayLocalIso } from '~/utils/format'
import { shiftDate } from '~/composables/useWeekNavigation'

/**
 * GAP-010 regression.
 *
 * "Today" was computed with `new Date().toISOString()`, which is the **UTC**
 * date. In the evening behind UTC that is already tomorrow, so the timesheet
 * highlighted the wrong day column.
 */
describe('todayLocalIso', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the local date, not the UTC date, in the evening behind UTC', () => {
    // 2026-10-23 21:30 in UTC-5 is 2026-10-24 02:30 UTC.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T02:30:00.000Z'))

    const today = todayLocalIso()
    const utc = new Date().toISOString().slice(0, 10)

    // The local date differs from the UTC date in this situation…
    expect(utc).toBe('2026-10-24')
    // …and the helper reports the local one.
    expect(today).not.toBe(utc)
  })

  it('formats the local date as YYYY-MM-DD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T12:00:00.000Z'))

    expect(todayLocalIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(todayLocalIso()).toHaveLength(10)
  })

  it('accepts an explicit Date so callers can be deterministic', () => {
    // Built from local components, so the expectation holds in any timezone.
    const local = new Date(2026, 9, 23, 21, 30, 0)
    expect(todayLocalIso(local)).toBe('2026-10-23')
  })

  it('is what the timesheet uses for the today marker', async () => {
    // Sweep the whole app for the GAP-010 pattern: a calendar date derived from
    // `toISOString()`, which is always UTC.
    const { readdir, readFile } = await import('node:fs/promises')
    const { join, resolve } = await import('node:path')

    // Vitest runs from the frontend/ root.
    const root = resolve(process.cwd(), 'app')
    const offenders: string[] = []

    async function walk(dir: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        }
        else if (entry.name.endsWith('.vue') || entry.name.endsWith('.ts')) {
          const source = await readFile(full, 'utf8')
          // Strip comments so prose mentioning `toISOString()` is not a hit.
          const code = source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/(^|[^:])\/\/.*$/gm, '$1')
          if (code.includes('toISOString()')) {
            offenders.push(full.replace(`${root}/`, ''))
          }
        }
      }
    }

    await walk(root)

    expect(offenders).toEqual([])
  })
})

/**
 * The week navigation's date arithmetic is deliberately UTC — it is the exact
 * inverse of `Date.UTC`. Replacing it with local getters would move the week
 * by a day west of UTC, so it must keep using the UTC accessors.
 */
describe('shiftDate stays in UTC', () => {
  it('adds days without drifting across a timezone boundary', async () => {
    const { useWeekNavigation } = await import('~/composables/useWeekNavigation')
    const { shiftDate: shift } = useWeekNavigation()

    expect(shift('2026-10-19', 7)).toBe('2026-10-26')
    expect(shift('2026-10-19', -7)).toBe('2026-10-12')
    expect(shift('2026-10-19', 0)).toBe('2026-10-19')
  })

  it('crosses a month boundary correctly', async () => {
    const { useWeekNavigation } = await import('~/composables/useWeekNavigation')
    const { shiftDate: shift } = useWeekNavigation()

    expect(shift('2026-10-26', 7)).toBe('2026-11-02')
    expect(shift('2026-11-02', -7)).toBe('2026-10-26')
  })
})
