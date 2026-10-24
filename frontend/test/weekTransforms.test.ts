import { describe, expect, it } from 'vitest'

import type { ClientSummary, ProjectSummary, Week, WorkRecord } from '~/types/api'
import { totalsFromDays, withRecord, withTotals, withoutRecord } from '~/composables/useRecords'

const acme: ClientSummary = {
  id: 1,
  name: 'Acme Corp',
  contactEmail: 'billing@acme.example',
  ccEmail: null,
  billingHour: 130,
}

const storefront: ProjectSummary = { id: 1, name: 'E-Commerce Storefront', clientId: 1 }

function makeRecord(overrides: Partial<WorkRecord> = {}): WorkRecord {
  const hours = overrides.hours ?? 3.5
  const rate = overrides.rate ?? 130
  return {
    id: 1,
    weekId: 1,
    projectId: 1,
    project: storefront,
    clientId: 1,
    client: acme,
    description: 'Checkout flow rebuild',
    hours,
    date: '2026-10-19',
    rate,
    lineTotal: hours * rate,
    createdAt: '2026-10-22T18:04:11.120Z',
    updatedAt: '2026-10-22T18:04:11.120Z',
    ...overrides,
  }
}

/** Contract §3.6 day shape, with empty days so the tests exercise the empty path. */
function makeWeek(days: Array<{ date: string, isWeekend?: boolean, records?: WorkRecord[] }>): Week {
  const padded = days.map(day => ({
    date: day.date,
    dayName: 'Mon',
    dayOfWeek: 1,
    isWeekend: day.isWeekend ?? false,
    hours: 0,
    projectedGross: 0,
    records: day.records ?? [],
  }))

  return {
    id: 1,
    startDate: '2026-10-19',
    endDate: '2026-10-25',
    status: 'open',
    closedAt: null,
    label: 'Week 43: 19-10-2026 – 25-10-2026',
    isoWeek: 43,
    days: padded,
    totals: {
      totalHours: 0,
      projectedGross: 0,
      targetHours: 40,
      belowTarget: true,
      hoursBelowTarget: 40,
      clientCount: 0,
      recordCount: 0,
      byProject: [],
      byClient: [],
    },
    invoiceCount: 0,
  }
}

const ALL_DAYS = [
  { date: '2026-10-19' },
  { date: '2026-10-20' },
  { date: '2026-10-21' },
  { date: '2026-10-22' },
  { date: '2026-10-23' },
  { date: '2026-10-24', isWeekend: true },
  { date: '2026-10-25', isWeekend: true },
]

describe('withTotals', () => {
  it('recomputes per-day hours and gross from the record list', () => {
    const days = withTotals([{
      date: '2026-10-19',
      dayName: 'Mon',
      dayOfWeek: 1,
      isWeekend: false,
      hours: 0,
      projectedGross: 0,
      records: [makeRecord({ hours: 3.5 }), makeRecord({ id: 2, hours: 2 })],
    }])

    expect(days[0]!.hours).toBe(5.5)
    expect(days[0]!.projectedGross).toBe(715)
  })

  it('does not mutate the input days (project rule: immutable updates)', () => {
    const original = makeWeek(ALL_DAYS)
    const snapshot = JSON.stringify(original)

    withRecord(original, makeRecord())

    expect(JSON.stringify(original)).toBe(snapshot)
  })
})

describe('withRecord', () => {
  it('inserts a record into the day matching its date', () => {
    const week = withRecord(makeWeek(ALL_DAYS), makeRecord({ date: '2026-10-21' }))

    expect(week.days.find(d => d.date === '2026-10-21')!.records).toHaveLength(1)
    expect(week.days.find(d => d.date === '2026-10-21')!.hours).toBe(3.5)
  })

  it('places weekend records in the weekend column rather than dropping them', () => {
    const week = withRecord(makeWeek(ALL_DAYS), makeRecord({ id: 9, date: '2026-10-24' }))
    const saturday = week.days.find(d => d.date === '2026-10-24')!

    expect(saturday.isWeekend).toBe(true)
    expect(saturday.records).toHaveLength(1)
  })

  it('replaces rather than duplicates a record with the same id', () => {
    const seeded = makeWeek([{ date: '2026-10-19', records: [makeRecord({ hours: 3.5 })] }])
    const week = withRecord(seeded, makeRecord({ hours: 6 }))

    expect(week.days[0]!.records).toHaveLength(1)
    expect(week.days[0]!.hours).toBe(6)
  })

  it('moves a record when its date changes', () => {
    const seeded = makeWeek([
      { date: '2026-10-19', records: [makeRecord()] },
      { date: '2026-10-20', records: [] },
    ])
    const week = withRecord(seeded, makeRecord({ date: '2026-10-20' }))

    expect(week.days[0]!.records).toHaveLength(0)
    expect(week.days[1]!.records).toHaveLength(1)
    expect(week.days[1]!.records[0]!.date).toBe('2026-10-20')
  })

  it('keeps totals in step with the records', () => {
    const week = withRecord(makeWeek(ALL_DAYS), makeRecord({ hours: 34.5, rate: 130 }))
    const totals = totalsFromDays(week)

    expect(totals.totalHours).toBe(34.5)
    expect(totals.projectedGross).toBe(4485)
    expect(totals.recordCount).toBe(1)
    expect(totals.clientCount).toBe(1)
    expect(totals.belowTarget).toBe(true)
    expect(totals.hoursBelowTarget).toBe(5.5)
  })

  it('does not count the standalone bucket as a client', () => {
    const week = withRecord(makeWeek(ALL_DAYS), makeRecord({
      id: 3,
      clientId: null,
      client: null,
      projectId: 4,
      project: { id: 4, name: 'Internal Tools', clientId: null },
      hours: 2.5,
      rate: 95,
    }))

    expect(totalsFromDays(week).clientCount).toBe(0)
  })

  it('clears belowTarget once the target is met', () => {
    const week = withRecord(makeWeek(ALL_DAYS), makeRecord({ hours: 40, rate: 100 }))
    const totals = totalsFromDays(week)

    expect(totals.belowTarget).toBe(false)
    expect(totals.hoursBelowTarget).toBe(0)
  })
})

describe('withoutRecord', () => {
  it('removes only the targeted record and updates totals', () => {
    const seeded = makeWeek([
      { date: '2026-10-19', records: [makeRecord({ id: 1, hours: 3.5 }), makeRecord({ id: 2, hours: 2 })] },
    ])

    const week = withoutRecord(seeded, 1)

    expect(week.days[0]!.records.map(r => r.id)).toEqual([2])
    expect(week.days[0]!.hours).toBe(2)
  })

  it('is a no-op for an unknown id', () => {
    const seeded = makeWeek([{ date: '2026-10-19', records: [makeRecord()] }])
    const week = withoutRecord(seeded, 999)

    expect(week.days[0]!.records).toHaveLength(1)
  })
})

describe('totalsFromDays', () => {
  it('counts distinct clients, not records', () => {
    const seeded = makeWeek([
      { date: '2026-10-19', records: [makeRecord({ id: 1 }), makeRecord({ id: 2 })] },
    ])

    expect(totalsFromDays(seeded).clientCount).toBe(1)
    expect(totalsFromDays(seeded).recordCount).toBe(2)
  })

  it('rounds to 2dp like the backend money contract', () => {
    const seeded = makeWeek([
      { date: '2026-10-19', records: [makeRecord({ hours: 0.1, rate: 33.33 })] },
    ])

    expect(totalsFromDays(seeded).projectedGross).toBe(3.33)
  })
})