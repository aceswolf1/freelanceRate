import type { EarningsGroupBy, EarningsReport, EarningsRow, EarningsUnbilled } from '../types/api'

/**
 * Earnings (R13) — `GET /api/reports/earnings?from&to&groupBy`.
 *
 * All three query params are optional; omitting `from`/`to` asks the API for its
 * contracted defaults (earliest/latest **record** date — see contract §8.1), which
 * is exactly what the "All time" preset should do.
 */

export type RangePreset = 'week' | 'month' | 'year' | 'all'

export const RANGE_PRESETS: Array<{ value: RangePreset, label: string }> = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

export interface DateRange {
  /** ISO `YYYY-MM-DD`, or `''` to let the API apply its own default. */
  from: string
  to: string
}

export const EMPTY_RANGE: DateRange = { from: '', to: '' }

/** Last day (28–31) of a UTC month. */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Resolve a preset against "now", in UTC components only.
 *
 * Mirrors the backend's week definition (Mon–Sun, §1.2) so "This week" selects
 * exactly the week the timesheet is showing.
 */
export function rangeForPreset(preset: RangePreset, today: Date = new Date()): DateRange {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()
  const day = today.getUTCDate()

  if (preset === 'all') {
    return { ...EMPTY_RANGE }
  }

  if (preset === 'week') {
    // getUTCDay() is 0 for Sunday; shift so Monday is the first day.
    const mondayOffset = (today.getUTCDay() + 6) % 7
    const monday = new Date(Date.UTC(year, month, day - mondayOffset))
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)
    return { from: isoOf(monday), to: isoOf(sunday) }
  }

  if (preset === 'month') {
    const last = daysInMonth(year, month)
    return {
      from: isoOf(new Date(Date.UTC(year, month, 1))),
      to: isoOf(new Date(Date.UTC(year, month, last))),
    }
  }

  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/**
 * ISO date from a `Date` that was anchored with `Date.UTC`.
 *
 * Deliberately **UTC** — it is the exact inverse of the anchoring, so reading
 * the local getters here would return the previous day west of UTC. This is
 * date arithmetic, not "today"; see `todayLocalIso()` for that (GAP-010).
 */
function isoOf(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `2026-10-19` → `Date` at **local** midnight, so the picker's own getters round-trip it. */
export function isoToLocalDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null
  }

  const [year, month, day] = iso.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    return null
  }
  return new Date(year, month - 1, day)
}

/** Inverse of {@link isoToLocalDate} — local components only, so no timezone shift. */
export function localDateToIso(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) {
    return ''
  }
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Client-side guard for the contracted `VALIDATION_ERROR` on `from` after `to`
 * (§4.8). ISO strings sort lexicographically, so no Date round-trip is needed.
 */
export function isRangeInvalid(range: DateRange): boolean {
  if (!range.from || !range.to) {
    return false
  }
  return range.from > range.to
}

const EMPTY_TOTALS = { hours: 0, gross: 0, fees: 0, net: 0 }
const EMPTY_UNBILLED: EarningsUnbilled = { hours: 0, gross: 0, fees: 0, net: 0, weekCount: 0 }

export function useEarningsState() {
  return useState<EarningsReport | null>('bf:earnings:report', () => null)
}

export function useEarnings() {
  const report = useEarningsState()
  const pending = useState<boolean>('bf:earnings:pending', () => false)
  const loaded = useState<boolean>('bf:earnings:loaded', () => false)
  const from = useState<string>('bf:earnings:from', () => '')
  const to = useState<string>('bf:earnings:to', () => '')
  const groupBy = useState<EarningsGroupBy>('bf:earnings:groupBy', () => 'project')
  const preset = useState<RangePreset | null>('bf:earnings:preset', () => null)

  const api = useApi()

  const rows = computed<EarningsRow[]>(() => report.value?.rows ?? [])
  const totals = computed(() => report.value?.totals ?? EMPTY_TOTALS)
  /** §8.1 additive block — logged work no issued invoice covers yet. */
  const unbilled = computed<EarningsUnbilled>(() => report.value?.unbilled ?? EMPTY_UNBILLED)
  const currencySymbol = computed(() => report.value?.currencySymbol ?? useSettings().currencySymbol.value)
  const effectiveRange = computed<DateRange>(() => ({
    from: from.value || report.value?.from || '',
    to: to.value || report.value?.to || '',
  }))
  const invalidRange = computed(() => isRangeInvalid(effectiveRange.value))
  const isEmpty = computed(() => rows.value.length === 0)
  /** §8.1: hide the unbilled block entirely when nothing in range is uninvoiced. */
  const hasUnbilled = computed(() => unbilled.value.weekCount > 0)

  /**
   * Refresh the report. Invalid ranges are rejected locally so the user gets an
   * inline message instead of a toast from a request that cannot succeed.
   */
  async function load(options: { force?: boolean } = {}): Promise<void> {
    // `loaded` lives in useState, so a server-rendered fetch is not repeated on hydration.
    if (pending.value || (loaded.value && !options.force) || invalidRange.value) {
      return
    }

    pending.value = true
    try {
      report.value = await api.get<EarningsReport>('/reports/earnings', {
        query: {
          groupBy: groupBy.value,
          ...(from.value ? { from: from.value } : {}),
          ...(to.value ? { to: to.value } : {}),
        },
        silent: true,
      })
      loaded.value = true
    }
    finally {
      pending.value = false
    }
  }

  /** Apply a preset and refetch. */
  async function applyPreset(next: RangePreset): Promise<void> {
    const range = rangeForPreset(next)
    from.value = range.from
    to.value = range.to
    preset.value = next
    await load({ force: true })
  }

  /** Manual range edit — clears the preset chip because it no longer describes the range. */
  async function setRange(range: DateRange): Promise<void> {
    from.value = range.from
    to.value = range.to
    preset.value = null
    await load({ force: true })
  }

  async function setGroupBy(next: EarningsGroupBy): Promise<void> {
    if (groupBy.value === next) {
      return
    }
    groupBy.value = next
    await load({ force: true })
  }

  /** `DatePicker` range model — local-midnight dates, converted component-wise. */
  const pickerRange = computed<Date[] | null>({
    get() {
      const start = isoToLocalDate(from.value)
      const end = isoToLocalDate(to.value)
      return start && end ? [start, end] : null
    },
    set(next) {
      const range = next as Date[] | null
      if (!range || range.length < 2) {
        void setRange({ from: from.value, to: to.value })
        return
      }
      void setRange({ from: localDateToIso(range[0]), to: localDateToIso(range[1]) })
    },
  })

  function reset(): void {
    report.value = null
    from.value = ''
    to.value = ''
    groupBy.value = 'project'
    preset.value = null
    loaded.value = false
  }

  return {
    report,
    pending,
    loaded,
    from,
    to,
    groupBy,
    preset,
    rows,
    totals,
    unbilled,
    currencySymbol,
    effectiveRange,
    invalidRange,
    isEmpty,
    hasUnbilled,
    pickerRange,
    load,
    applyPreset,
    setRange,
    setGroupBy,
    reset,
  }
}