/**
 * Calendar helpers mirroring `backend/src/lib/dates.ts` (pure, no I/O).
 *
 * The E2E suite must stay deterministic, so every date it asserts on is derived
 * from the **run day** rather than hard-coded: the seed always builds the week
 * that contains "today", so the expected label/totals are computed the same way
 * the backend computes them.
 *
 * Convention: weeks run Mon–Sun and are identified by their Monday.
 * Display format is `DD-MM-YYYY`; ISO week numbers are 1-based.
 */
const MS_PER_DAY = 86_400_000

/** Local calendar date of `date` as `YYYY-MM-DD` (matches the backend's `toIsoDate`). */
export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Today in the runner's local timezone. */
export function todayIso(): string {
  return toIsoDate(new Date())
}

/**
 * Today in the **browser's** local timezone.
 *
 * The app marks the "today" column with `new Date().toISOString().slice(0, 10)`
 * — the UTC date — while the backend's `todayIso()` uses the local date. For a
 * user behind UTC the two disagree for part of the day.
 */
export function localTodayIso(): string {
  const now = new Date()
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number]
  return Date.UTC(year, month - 1, day)
}

function fromEpochMs(epochMs: number): string {
  const date = new Date(epochMs)
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(iso: string, days: number): string {
  return fromEpochMs(parseIsoDate(iso) + days * MS_PER_DAY)
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: string): number {
  return new Date(parseIsoDate(iso)).getUTCDay()
}

/** Monday of the week containing the given date (Sunday rolls back 6 days). */
export function weekStart(dateOrIso: string | Date): string {
  const iso = typeof dateOrIso === 'string' ? dateOrIso : toIsoDate(dateOrIso)
  const weekday = dayOfWeek(iso)
  const offset = weekday === 0 ? -6 : 1 - weekday
  return addDays(iso, offset)
}

/** Sunday of the week containing the given date. */
export function weekEnd(dateOrIso: string | Date): string {
  return addDays(weekStart(dateOrIso), 6)
}

/** The 7 calendar dates of a week, Monday first. */
export function weekDays(startIso: string): string[] {
  const start = weekStart(startIso)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/** ISO-8601 week number (1–53). */
export function isoWeekNumber(iso: string): number {
  const epochMs = parseIsoDate(iso)
  const weekday = new Date(epochMs).getUTCDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  const thursday = new Date(epochMs + (mondayOffset + 3) * MS_PER_DAY)
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.floor((thursday.getTime() - yearStart) / MS_PER_DAY / 7) + 1
}

/** `2026-10-19` → `19-10-2026`. */
export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-') as [string, string, string]
  return `${day}-${month}-${year}`
}

/** `Week 43: 19-10-2026 – 25-10-2026` (the label the API returns verbatim). */
export function weekTitle(startIso: string): string {
  const start = weekStart(startIso)
  const end = addDays(start, 6)
  return `Week ${isoWeekNumber(start)}: ${formatDisplayDate(start)} – ${formatDisplayDate(end)}`
}
