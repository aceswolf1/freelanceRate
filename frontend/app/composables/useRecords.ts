import type { Week, WorkRecord, WorkRecordInput, WorkRecordUpdate } from '../types/api'
import { ApiError } from './useApi'

/**
 * Work records (R5, R7) — `GET/POST /api/weeks/:id/records`,
 * `PATCH /api/records/:id`, `DELETE /api/records/:id`.
 *
 * Mutations are 409 `WEEK_CLOSED` when the week is closed and 400
 * `VALIDATION_ERROR` when the date falls outside it — both are surfaced by the
 * drawer rather than by the global toast.
 *
 * Every mutation returns the refreshed week so totals stay consistent without a
 * second round-trip.
 */
export function useRecords() {
  const { week, set, loadById } = useWeeks()
  const notifier = useNotifier()

  // Resolved once, here in setup: `useApi()` reads `useRuntimeConfig()`, which needs an
  // active Nuxt instance. Resolving it lazily inside an async function can run
  // after the context is gone (SSR) and throw.
  const api = useApi()

  async function refreshWeek(weekId: number): Promise<Week | null> {
    return loadById(weekId)
  }

  async function create(weekId: number, input: WorkRecordInput): Promise<WorkRecord> {
    const created = await api.post<WorkRecord>(`/weeks/${weekId}/records`, input, { silent: true })
    await refreshWeek(weekId)
    return created
  }

  async function update(recordId: number, patch: WorkRecordUpdate): Promise<WorkRecord> {
    const updated = await api.patch<WorkRecord>(`/records/${recordId}`, patch, { silent: true })
    const weekId = updated.weekId ?? week.value?.id
    if (weekId !== undefined) {
      await refreshWeek(weekId)
    }
    return updated
  }

  async function remove(recordId: number): Promise<void> {
    const weekId = week.value?.id
    await api.del(`/records/${recordId}`, { silent: true })
    if (weekId !== undefined) {
      await refreshWeek(weekId)
    }
  }

  /**
   * Local-only patch so the grid feels instant. The week totals are recomputed
   * from `days[]` rather than nudged, so they can never drift from the records.
   */
  function applyLocalRecord(next: WorkRecord): void {
    if (!week.value) {
      return
    }
    set(withRecord(week.value, next))
  }

  function applyLocalRemoval(recordId: number): void {
    if (!week.value) {
      return
    }
    set(withoutRecord(week.value, recordId))
  }

  return {
    week,
    create,
    update,
    remove,
    refreshWeek,
    applyLocalRecord,
    applyLocalRemoval,
    notifyError: (message: string) => notifier.error('Could not save the record', message),
  }
}

/**
 * Pure week transforms.
 *
 * Rebuilt rather than mutated (project rule): totals are derived from `days[]`
 * so an optimistic update can never disagree with the records it shows.
 */
/**
 * Insert, replace **or move** a record.
 *
 * The record is removed from every day first, then re-inserted into the day
 * matching its date — otherwise editing an entry's date would leave a stale copy
 * behind in the original column.
 */
export function withRecord(week: Week, record: WorkRecord): Week {
  const days = withTotals(week.days.map((day) => ({
    ...day,
    records: [
      ...day.records.filter(r => r.id !== record.id),
      ...(day.date === record.date ? [record] : []),
    ],
  })))

  const next = { ...week, days }
  return { ...next, totals: totalsFromDays(next) }
}

export function withoutRecord(week: Week, recordId: number): Week {
  const days = withTotals(week.days.map(day => ({
    ...day,
    records: day.records.filter(r => r.id !== recordId),
  })))

  const next = { ...week, days }
  return { ...next, totals: totalsFromDays(next) }
}

/** Recompute per-day hours/gross and the week totals from the record list. */
export function withTotals(days: Week['days']): Week['days'] {
  return days.map(day => ({
    ...day,
    hours: round2(day.records.reduce((sum, r) => sum + r.hours, 0)),
    projectedGross: round2(day.records.reduce((sum, r) => sum + r.lineTotal, 0)),
  }))
}

/**
 * Week-level totals derived from the records themselves rather than from the
 * day aggregates, so the result is correct even for a week whose `days[]` have
 * not been through `withTotals` yet.
 */
export function totalsFromDays(week: Week): Week['totals'] {
  const allRecords = week.days.flatMap(day => day.records)

  const totalHours = round2(allRecords.reduce((sum, r) => sum + r.hours, 0))
  const projectedGross = round2(allRecords.reduce((sum, r) => sum + r.lineTotal, 0))
  const targetHours = week.totals.targetHours ?? 40

  const clientIds = new Set<number>()
  for (const record of allRecords) {
    if (record.clientId !== null) {
      clientIds.add(record.clientId)
    }
  }

  return {
    ...week.totals,
    totalHours,
    projectedGross,
    targetHours,
    belowTarget: totalHours < targetHours,
    hoursBelowTarget: round2(Math.max(0, targetHours - totalHours)),
    clientCount: clientIds.size,
    recordCount: allRecords.length,
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100

/** True when the API rejected the write because the week is closed (R7). */
export function isWeekClosedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'WEEK_CLOSED'
}