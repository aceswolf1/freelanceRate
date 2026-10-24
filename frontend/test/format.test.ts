import { describe, expect, it } from 'vitest'

import {
  dayLongLabel,
  dayShortLabel,
  formatDate,
  formatDisplayId,
  formatHours,
  formatLongDate,
  formatMoney,
  formatMoneyCompact,
  formatRate,
  formatShortDate,
  formatWeekTitle,
  initials,
  isoWeekNumber,
  parseIsoDate,
  toPercent,
} from '~/utils/format'

describe('parseIsoDate', () => {
  it('splits a YYYY-MM-DD string component-wise', () => {
    expect(parseIsoDate('2026-10-19')).toEqual({ year: 2026, month: 10, day: 19 })
  })

  it('returns null for malformed or missing input', () => {
    expect(parseIsoDate('19-10-2026')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
    expect(parseIsoDate(null)).toBeNull()
    expect(parseIsoDate(undefined)).toBeNull()
  })
})

describe('formatDate', () => {
  it('renders DD-MM-YYYY (team plan: UI shows DD-MM-YYYY)', () => {
    expect(formatDate('2026-10-19')).toBe('19-10-2026')
    expect(formatDate('2026-01-05')).toBe('05-01-2026')
  })

  it('degrades to an em dash rather than throwing', () => {
    expect(formatDate('not-a-date')).toBe('—')
    expect(formatDate(null)).toBe('—')
  })
})

describe('day labels', () => {
  it('labels days Monday-first', () => {
    expect(dayShortLabel('2026-10-19')).toBe('Mon')
    expect(dayShortLabel('2026-10-25')).toBe('Sun')
    expect(dayLongLabel('2026-10-24')).toBe('Saturday')
  })

  it('formats the short header form', () => {
    expect(formatShortDate('2026-10-19')).toBe('Mon 19-10')
  })

  it('formats the drawer heading form', () => {
    expect(formatLongDate('2026-10-24')).toBe('Saturday, 24-10-2026')
  })
})

describe('isoWeekNumber', () => {
  it('matches ISO-8601 week numbering', () => {
    expect(isoWeekNumber('2026-10-19')).toBe(43)
    expect(isoWeekNumber('2026-01-01')).toBe(1)
    // 2027-01-01 is a Friday, still inside ISO week 53 of 2026.
    expect(isoWeekNumber('2027-01-01')).toBe(53)
  })

  it('returns null for unparseable dates', () => {
    expect(isoWeekNumber('nope')).toBeNull()
  })
})

describe('formatWeekTitle', () => {
  it('builds the R4 heading from the week boundaries', () => {
    expect(formatWeekTitle('2026-10-19', '2026-10-25')).toBe('Week 43: 19-10-2026 – 25-10-2026')
  })

  it('honours an explicit week number from the API', () => {
    expect(formatWeekTitle('2026-10-19', '2026-10-25', 7)).toBe('Week 7: 19-10-2026 – 25-10-2026')
  })

  it('omits the range when no end date is known', () => {
    expect(formatWeekTitle('2026-10-19')).toBe('Week 43: 19-10-2026')
  })
})

describe('formatHours', () => {
  it('always shows one decimal so columns line up', () => {
    expect(formatHours(5.5)).toBe('5.5h')
    expect(formatHours(8)).toBe('8.0h')
    expect(formatHours('2.25')).toBe('2.3h')
  })

  it('treats missing values as zero', () => {
    expect(formatHours(null)).toBe('0.0h')
    expect(formatHours(undefined)).toBe('0.0h')
  })
})

describe('formatMoney', () => {
  it('uses the settings currency symbol', () => {
    expect(formatMoney(130, '$')).toBe('$130.00')
    expect(formatMoney(4312.5, '€')).toBe('€4312.50')
  })

  it('defaults to $ and two decimals', () => {
    expect(formatMoney(715)).toBe('$715.00')
  })

  it('formats rates with the /hr suffix', () => {
    expect(formatRate(115)).toBe('$115.00/hr')
    expect(formatRate(95, '£')).toBe('£95.00/hr')
  })

  it('compacts large amounts for stat tiles', () => {
    expect(formatMoneyCompact(18_500)).toBe('$18.5k')
    expect(formatMoneyCompact(1_250_000)).toBe('$1.25M')
    expect(formatMoneyCompact(125)).toBe('$125.00')
  })
})

describe('formatDisplayId', () => {
  it('zero-pads to three digits', () => {
    expect(formatDisplayId('CLI', 1)).toBe('#CLI-001')
    expect(formatDisplayId('PRJ', 101)).toBe('#PRJ-101')
    expect(formatDisplayId('CLI', 1234)).toBe('#CLI-1234')
  })

  it('degrades gracefully without an id', () => {
    expect(formatDisplayId('CLI', null)).toBe('#CLI-—')
  })
})

describe('initials', () => {
  it('takes up to two leading letters', () => {
    expect(initials('Acme Corp')).toBe('AC')
    expect(initials('Starlight Media')).toBe('SM')
    expect(initials('Vanguard')).toBe('V')
    expect(initials('Morgan Architecture LLC')).toBe('MA')
  })

  it('falls back for empty names', () => {
    expect(initials('')).toBe('?')
    expect(initials(null)).toBe('?')
  })
})

describe('toPercent', () => {
  it('computes progress against the target', () => {
    expect(toPercent(34.5, 40)).toBeCloseTo(86.25, 2)
  })

  it('clamps to 0–100 and survives a zero target', () => {
    expect(toPercent(60, 40)).toBe(100)
    expect(toPercent(-5, 40)).toBe(0)
    expect(toPercent(10, 0)).toBe(0)
  })
})