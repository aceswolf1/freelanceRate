/**
 * Shared display formatting.
 *
 * Dates cross the API as `YYYY-MM-DD` strings (team plan: no JS Date timezone
 * shifting), so everything here parses them component-wise and never round-trips
 * through the local timezone.
 */

export type IsoDate = string

export interface DateParts {
  year: number
  month: number
  day: number
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** `2026-10-19` → `{ year: 2026, month: 10, day: 19 }`. `null` when unparseable. */
export function parseIsoDate(value: string | null | undefined): DateParts | null {
  if (!value) {
    return null
  }

  const match = ISO_DATE_RE.exec(value.trim())
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  }
}

const pad2 = (value: number): string => String(value).padStart(2, '0')

/**
 * Today's calendar date in the **local** timezone, as `YYYY-MM-DD`.
 *
 * GAP-010: `new Date().toISOString()` yields the *UTC* date, so in the evening
 * behind UTC the app highlighted tomorrow. The backend and the user's clock both
 * work in local terms, so "today" must too.
 */
export function todayLocalIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** `2026-10-19` → `19-10-2026`. Returns `—` for anything unparseable. */
export function formatDate(value: string | null | undefined): string {
  const parts = parseIsoDate(value)
  if (!parts) {
    return '—'
  }
  return `${pad2(parts.day)}-${pad2(parts.month)}-${parts.year}`
}

/** `2026-10-19` → `Mon 19-10`. Short form for day-column headers. */
export function formatShortDate(value: string | null | undefined): string {
  const parts = parseIsoDate(value)
  if (!parts) {
    return '—'
  }
  return `${dayShortLabel(value)} ${pad2(parts.day)}-${pad2(parts.month)}`
}

/** Monday-first day label: `Mon`, `Tue`, … `Sun`. */
export function dayShortLabel(value: string | null | undefined): string {
  const parts = parseIsoDate(value)
  if (!parts) {
    return '—'
  }
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][utc.getUTCDay()] ?? '—'
}

/** Full weekday name: `Monday`. */
export function dayLongLabel(value: string | null | undefined): string {
  const parts = parseIsoDate(value)
  if (!parts) {
    return '—'
  }
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][utc.getUTCDay()] ?? '—'
}

/** `Saturday, 24-10-2026` — the drawer heading format from the design. */
export function formatLongDate(value: string | null | undefined): string {
  const parts = parseIsoDate(value)
  if (!parts) {
    return '—'
  }
  return `${dayLongLabel(value)}, ${pad2(parts.day)}-${pad2(parts.month)}-${parts.year}`
}

/** ISO-8601 week number for an ISO date string. */
export function isoWeekNumber(value: string | null | undefined): number | null {
  const parts = parseIsoDate(value)
  if (!parts) {
    return null
  }

  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  // Thursday of the current week determines the ISO year.
  const day = (utc.getUTCDay() + 6) % 7
  utc.setUTCDate(utc.getUTCDate() - day + 3)
  const isoYear = utc.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)

  const diff = utc.getTime() - firstThursday.getTime()
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000))
}

/**
 * R4 week heading: `Week 43: 19-10-2026 – 25-10-2026` (en dash, no padding on week no).
 * The week number is derived from `startDate` when not supplied.
 */
export function formatWeekTitle(
  startDate: string | null | undefined,
  endDate?: string | null,
  weekNumber?: number | null,
): string {
  const number = weekNumber ?? isoWeekNumber(startDate)
  const prefix = number === null ? 'Week' : `Week ${number}`
  const start = formatDate(startDate)
  if (!endDate) {
    return `${prefix}: ${start}`
  }
  return `${prefix}: ${start} – ${formatDate(endDate)}`
}

/** `5.5` → `5.5h`; `8` → `8.0h`. Trailing `.0` is kept so columns line up. */
export function formatHours(hours: number | string | null | undefined, unit = 'h'): string {
  const value = toNumber(hours)
  if (value === null) {
    return '0.0h'
  }
  return `${value.toFixed(1)}${unit}`
}

/** `130` → `$130.00`. Currency symbol comes from settings (R15). */
export function formatMoney(
  amount: number | string | null | undefined,
  symbol = '$',
  decimals = 2,
): string {
  const value = toNumber(amount)
  if (value === null) {
    return `${symbol}${(0).toFixed(decimals)}`
  }
  return `${symbol}${value.toFixed(decimals)}`
}

/** Compact money for stat tiles: `$18.4k`. */
export function formatMoneyCompact(amount: number | string | null | undefined, symbol = '$'): string {
  const value = toNumber(amount) ?? 0
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(1)}k`
  }
  return `${symbol}${value.toFixed(2)}`
}

/** `130` → `$130.00/hr` — the rate badge format used in the project/record cards. */
export function formatRate(rate: number | string | null | undefined, symbol = '$'): string {
  return `${formatMoney(rate, symbol)}/hr`
}

/** `1` → `#CLI-001`. Display IDs only; the wire format stays numeric. */
export function formatDisplayId(prefix: string, id: number | string | null | undefined): string {
  const value = toNumber(id)
  if (value === null) {
    return `#${prefix}-—`
  }
  return `#${prefix}-${String(value).padStart(3, '0')}`
}

/** `Acme Corp` → `AC`. Used by the avatar chips in the clients table. */
export function initials(name: string | null | undefined, max = 2): string {
  if (!name) {
    return '?'
  }

  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return '?'
  }

  const letters = words.slice(0, max).map(word => word[0]?.toUpperCase() ?? '')
  return letters.join('')
}

/** Percentage clamped to 0–100, used by the weekly target progress bar. */
export function toPercent(value: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, (value / total) * 100))
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}