/**
 * Calendar helpers for Mon–Sun weeks.
 *
 * Every date in this codebase is a `YYYY-MM-DD` **string** end-to-end (DB
 * `date` columns, DTOs, query params). All arithmetic happens on UTC midnight
 * timestamps purely as a calendar device, so no local-timezone shift can ever
 * move a day across a boundary.
 *
 * Pure module — no I/O, no `Date.now()` unless a default argument is omitted.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

export const WEEK_START_INDEX = 1; // Monday
export const WEEK_END_INDEX = 0; // Sunday

/** `true` when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const asUtc = Date.UTC(year, month - 1, day);
  const date = new Date(asUtc);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Epoch ms at UTC midnight for a `YYYY-MM-DD` string. Throws on bad input. */
export function parseIsoDate(value: string): number {
  if (!isIsoDate(value)) {
    throw new RangeError(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

/** Formats a `Date` using its **local** calendar fields (the user's "today"). */
export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today in the server's local timezone, as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function addDays(iso: string, days: number): string {
  return fromEpochMs(parseIsoDate(iso) + days * MS_PER_DAY);
}

export function diffDays(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso) - parseIsoDate(fromIso)) / MS_PER_DAY);
}

function fromEpochMs(epochMs: number): string {
  const date = new Date(epochMs);
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Day of week for `iso`: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: string): number {
  return new Date(parseIsoDate(iso)).getUTCDay();
}

/** Monday of the week containing `dateOrIso` (Sunday rolls back 6 days). */
export function weekStart(dateOrIso: string | Date): string {
  const iso = typeof dateOrIso === 'string' ? dateOrIso : toIsoDate(dateOrIso);
  const weekday = dayOfWeek(iso);
  const offset = weekday === WEEK_END_INDEX ? -6 : WEEK_START_INDEX - weekday;
  return addDays(iso, offset);
}

/** Sunday of the week containing `dateOrIso`. */
export function weekEnd(dateOrIso: string | Date): string {
  return addDays(weekStart(dateOrIso), DAYS_PER_WEEK - 1);
}

export function weekRange(dateOrIso: string | Date): { start: string; end: string } {
  const start = weekStart(dateOrIso);
  return { start, end: addDays(start, DAYS_PER_WEEK - 1) };
}

/** The 7 calendar dates of a week, Monday first. */
export function weekDays(startIso: string): string[] {
  const start = weekStart(startIso);
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => addDays(start, index));
}

/** `true` when `dateIso` falls inside the Mon–Sun week starting at `weekStartIso`. */
export function isWithinWeek(dateIso: string, weekStartIso: string): boolean {
  const start = weekStart(weekStartIso);
  return diffDays(start, dateIso) >= 0 && diffDays(start, dateIso) < DAYS_PER_WEEK;
}

/** ISO-8601 week number (1–53) for `iso`. */
export function isoWeekNumber(iso: string): number {
  const epochMs = parseIsoDate(iso);
  // ISO weeks start Monday; shift to the Thursday of this week to count correctly.
  const weekday = new Date(epochMs).getUTCDay();
  const mondayOffset = weekday === WEEK_END_INDEX ? -6 : WEEK_START_INDEX - weekday;
  const thursday = new Date(epochMs + (mondayOffset + 3) * MS_PER_DAY);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / MS_PER_DAY / 7) + 1;
}

/** UI display format from the shared conventions: `DD-MM-YYYY`. */
export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-') as [string, string, string];
  return `${day}-${month}-${year}`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** `19-10-2026` → `Oct 19, 2026` (used by PDF / email bodies). */
export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** Week heading from R4, e.g. `Week 43: 19-10-2026 – 25-10-2026`. */
export function weekTitle(startIso: string): string {
  const start = weekStart(startIso);
  const end = addDays(start, DAYS_PER_WEEK - 1);
  return `Week ${isoWeekNumber(start)}: ${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
}