import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  diffDays,
  formatDisplayDate,
  formatLongDate,
  isIsoDate,
  isWithinWeek,
  isoWeekNumber,
  parseIsoDate,
  toIsoDate,
  todayIso,
  weekDays,
  weekEnd,
  weekRange,
  weekStart,
  weekTitle,
} from './dates.js';

describe('isIsoDate', () => {
  it('accepts real calendar dates in YYYY-MM-DD form', () => {
    expect(isIsoDate('2026-10-19')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('2026-2-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-02-30')).toBe(false); // February has no 30th
    expect(isIsoDate('2025-02-29')).toBe(false); // 2025 is not a leap year
    expect(isIsoDate('19-10-2026')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('parseIsoDate', () => {
  it('throws on invalid input', () => {
    expect(() => parseIsoDate('2026-02-30')).toThrow(RangeError);
  });

  it('round-trips through toIsoDate/addDays', () => {
    expect(addDays('2026-10-19', 0)).toBe('2026-10-19');
  });
});

describe('toIsoDate / todayIso', () => {
  it('uses local calendar fields, not UTC', () => {
    expect(toIsoDate(new Date(2026, 9, 19, 23, 30))).toBe('2026-10-19');
    expect(todayIso(new Date(2026, 0, 1, 8, 0))).toBe('2026-01-01');
  });
});

describe('weekStart / weekEnd', () => {
  it('returns the Monday of the week for every weekday', () => {
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Monday
    expect(weekStart('2026-10-20')).toBe('2026-10-19');
    expect(weekStart('2026-10-22')).toBe('2026-10-19');
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday
  });

  it('rolls a Sunday back to the PREVIOUS Monday', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekEnd('2026-10-25')).toBe('2026-10-25');
  });

  it('maps a Date to its Monday', () => {
    expect(weekStart(new Date(2026, 9, 22, 12, 0))).toBe('2026-10-19');
  });

  it('crosses the year boundary backwards', () => {
    // 2026-01-01 is a Thursday → Monday 2025-12-29.
    expect(weekStart('2026-01-01')).toBe('2025-12-29');
    expect(weekEnd('2026-01-01')).toBe('2026-01-04');
  });
});

describe('weekRange / weekDays', () => {
  it('returns the Mon–Sun range', () => {
    expect(weekRange('2026-10-22')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });

  it('returns exactly 7 days, Monday first', () => {
    const days = weekDays('2026-10-22');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-10-19');
    expect(days[6]).toBe('2026-10-25');
    expect(days).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  it('accepts any day of the week as the argument', () => {
    expect(weekDays('2026-10-25')).toEqual(weekDays('2026-10-19'));
  });
});

describe('isWithinWeek', () => {
  it('includes both endpoints and excludes everything else', () => {
    expect(isWithinWeek('2026-10-19', '2026-10-19')).toBe(true);
    expect(isWithinWeek('2026-10-25', '2026-10-19')).toBe(true);
    expect(isWithinWeek('2026-10-18', '2026-10-19')).toBe(false);
    expect(isWithinWeek('2026-10-26', '2026-10-19')).toBe(false);
  });

  it('normalises a non-Monday argument to its Monday', () => {
    expect(isWithinWeek('2026-10-20', '2026-10-25')).toBe(true);
  });
});

describe('isoWeekNumber', () => {
  it('matches the design reference week', () => {
    expect(isoWeekNumber('2026-10-19')).toBe(43);
  });

  it('handles the year boundary (ISO weeks belong to the Thursday year)', () => {
    expect(isoWeekNumber('2026-01-01')).toBe(1);
    expect(isoWeekNumber('2025-12-29')).toBe(1);
    expect(isoWeekNumber('2025-12-28')).toBe(52); // Sunday belongs to the earlier week
  });
});

describe('date formatting', () => {
  it('formats DD-MM-YYYY for the UI', () => {
    expect(formatDisplayDate('2026-10-19')).toBe('19-10-2026');
  });

  it('formats a long English date for PDF/email bodies', () => {
    expect(formatLongDate('2026-10-19')).toBe('Oct 19, 2026');
  });

  it('builds the R4 week title', () => {
    expect(weekTitle('2026-10-22')).toBe('Week 43: 19-10-2026 – 25-10-2026');
  });
});

describe('calendar arithmetic', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-10-19', -1)).toBe('2026-10-18');
  });

  it('diffs dates in both directions', () => {
    expect(diffDays('2026-10-19', '2026-10-25')).toBe(6);
    expect(diffDays('2026-10-25', '2026-10-19')).toBe(-6);
  });

  it('reports day of week with Sunday = 0', () => {
    expect(dayOfWeek('2026-10-18')).toBe(0); // Sunday
    expect(dayOfWeek('2026-10-19')).toBe(1); // Monday
    expect(dayOfWeek('2026-10-25')).toBe(0); // Sunday
  });
});