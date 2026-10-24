import type { Week } from '../types/api'
import { parseIsoDate } from '../utils/format'

const pad2 = (value: number): string => String(value).padStart(2, '0')

/**
 * Prev/next week navigation.
 *
 * Contract §3.6: `/api/weeks/by-date/:date` is get-or-create and always returns
 * 200, so navigation just asks for "the week containing this date" rather than
 * computing an offset and hoping the target week already exists.
 */
export function useWeekNavigation() {
  const { week, pending, load, loadByDate, close, reopen } = useWeeks()
  const notifier = useNotifier()

  /**
   * `YYYY-MM-DD` string arithmetic.
   *
   * Deliberately **UTC**: the date is anchored with `Date.UTC` and shifted with
   * `setUTCDate`, so it is the exact inverse of the anchoring. Reading the local
   * getters here would return the previous day west of UTC. This is date
   * arithmetic, not "today" — see `todayLocalIso()` for that (GAP-010).
   */
  function shiftDate(isoDate: string, days: number): string | null {
    const parts = parseIsoDate(isoDate)
    if (!parts) {
      return null
    }
    const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
    utc.setUTCDate(utc.getUTCDate() + days)
    return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`
  }

  async function goPrevious(): Promise<Week | null> {
    if (!week.value) {
      return week.value
    }
    const target = shiftDate(week.value.startDate, -7)
    return target === null ? week.value : loadByDate(target)
  }

  async function goNext(): Promise<Week | null> {
    if (!week.value) {
      return week.value
    }
    const target = shiftDate(week.value.startDate, 7)
    return target === null ? week.value : loadByDate(target)
  }

  async function goToToday(): Promise<Week | null> {
    return load({ force: true })
  }

  /**
   * R7 close/reopen. Reopen is 409 when invoices already exist for the week
   * (contract §3.6), which is expected flow rather than a failure.
   */
  async function toggleClosed(): Promise<Week | null> {
    if (!week.value) {
      return week.value
    }

    try {
      const next = week.value.status === 'open'
        ? await close(week.value.id)
        : await reopen(week.value.id)
      notifier.success(next?.status === 'closed' ? 'Week closed' : 'Week reopened', next?.label)
      return next
    }
    catch (error) {
      if (isConflictLike(error)) {
        notifier.warn('Cannot change the week status', error instanceof Error ? error.message : undefined)
      }
      else {
        notifier.error('Unexpected error', error instanceof Error ? error.message : undefined)
      }
      return week.value
    }
  }

  return { week, pending, goPrevious, goNext, goToToday, toggleClosed, shiftDate }
}

function isConflictLike(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && ((error as { code?: string }).code === 'CONFLICT' || (error as { code?: string }).code === 'WEEK_CLOSED')
}