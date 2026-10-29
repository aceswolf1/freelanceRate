// @vitest-environment nuxt
/**
 * Behaviour tests for the timesheet presentational components:
 * `app/components/timesheet/RecordCard.vue`,
 * `app/components/timesheet/DayColumn.vue` and
 * `app/components/timesheet/TargetBanner.vue`.
 *
 * Scenarios covered:
 * - a record card names the client and the project, shows the hours and the
 *   line total, and flags a custom project rate against the client default;
 * - a record card emits `edit` / `remove`, and stays inert on a closed week;
 * - a day column lists its records, keeps weekend days insertable, and shows
 *   "Week closed" instead of the add button on a closed week;
 * - the target banner states the hours against the goal, flags being below
 *   target, and exposes the progress to assistive tech.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import type { WeekDay, WeekTotals, WorkRecord } from '~/types/api'
import DayColumn from '~/components/timesheet/DayColumn.vue'
import RecordCard from '~/components/timesheet/RecordCard.vue'
import TargetBanner from '~/components/timesheet/TargetBanner.vue'

function makeRecord(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: 1,
    weekId: 1,
    projectId: 1,
    project: { id: 1, name: 'E-Commerce Storefront', clientId: 1 },
    clientId: 1,
    client: { id: 1, name: 'Acme Corp', contactEmail: 'billing@acme.example', ccEmail: null, billingHour: 130 },
    description: 'Checkout flow rebuild',
    hours: 3.5,
    date: '2026-10-19',
    rate: 130,
    lineTotal: 455,
    createdAt: '2026-10-22T18:04:11.120Z',
    updatedAt: '2026-10-22T18:04:11.120Z',
    ...overrides,
  }
}

function makeDay(overrides: Partial<WeekDay> = {}): WeekDay {
  return {
    date: '2026-10-19',
    dayName: 'Mon',
    dayOfWeek: 1,
    isWeekend: false,
    hours: 3.5,
    projectedGross: 455,
    records: [makeRecord()],
    ...overrides,
  }
}

function makeTotals(overrides: Partial<WeekTotals> = {}): WeekTotals {
  return {
    totalHours: 34.5,
    projectedGross: 4180,
    targetHours: 40,
    belowTarget: true,
    hoursBelowTarget: 5.5,
    clientCount: 2,
    recordCount: 12,
    byProject: [],
    byClient: [],
    ...overrides,
  }
}

describe('RecordCard', () => {
  it('names the client and the project and shows the hours and total', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: { record: makeRecord(), readOnly: false, currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="record-client"]').text()).toBe('Acme Corp')
    expect(wrapper.text()).toContain('E-Commerce Storefront')
    expect(wrapper.text()).toContain('3.5h')
    expect(wrapper.text()).toContain('$455.00')
  })

  it('describes itself for screen readers', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: { record: makeRecord(), readOnly: false, currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="record-1"]').attributes('aria-label'))
      .toBe('E-Commerce Storefront, 3.5h for Acme Corp')
  })

  it('flags a custom project rate against the client default', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: { record: makeRecord({ rate: 150, lineTotal: 525 }), readOnly: false, currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="record-override"]').text()).toContain('Custom project rate applied')
    expect(wrapper.text()).toContain('$150.00')
    // The client default stays visible, struck through.
    expect(wrapper.text()).toContain('$130.00')
  })

  it('does not flag an inherited client rate', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: { record: makeRecord(), readOnly: false, currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="record-override"]').exists()).toBe(false)
  })

  it('emits edit when the card is clicked', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: { record: makeRecord(), readOnly: false, currencySymbol: '$' },
    })

    await wrapper.find('[data-testid="record-1"]').trigger('click')

    expect((wrapper.emitted('edit')![0]![0] as WorkRecord).id).toBe(1)
  })

  it('emits edit on Enter so the card is keyboard reachable', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: { record: makeRecord(), readOnly: false, currencySymbol: '$' },
    })

    await wrapper.find('[data-testid="record-1"]').trigger('keydown.enter')

    expect(wrapper.emitted('edit')).toHaveLength(1)
  })

  it('emits remove from the delete button', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: { record: makeRecord(), readOnly: false, currencySymbol: '$' },
    })

    await wrapper.find('[data-testid="delete-record-1"]').trigger('click')

    expect((wrapper.emitted('remove')![0]![0] as WorkRecord).id).toBe(1)
  })

  it('stays inert on a closed week — no edit, no delete', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: { record: makeRecord(), readOnly: true, currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="edit-record-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-record-1"]').exists()).toBe(false)

    await wrapper.find('[data-testid="record-1"]').trigger('click')
    expect(wrapper.emitted('edit')).toBeUndefined()
  })

  it('labels standalone work', async () => {
    const wrapper = await mountSuspended(RecordCard, {
      props: {
        record: makeRecord({ clientId: null, client: null, project: { id: 2, name: 'Internal Tools', clientId: null } }),
        readOnly: false,
        currencySymbol: '$',
      },
    })

    expect(wrapper.find('[data-testid="record-client"]').text()).toBe('Standalone')
  })
})

describe('DayColumn', () => {
  it('lists the records of the day', async () => {
    const wrapper = await mountSuspended(DayColumn, {
      props: { day: makeDay(), today: null, readOnly: false, currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="record-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('3.5h')
  })

  it('shows the empty state for a day without records', async () => {
    const wrapper = await mountSuspended(DayColumn, {
      props: { day: makeDay({ records: [] }), today: null, readOnly: false, currencySymbol: '$' },
    })

    expect(wrapper.text()).toContain('No active time entries')
  })

  it('marks today', async () => {
    const wrapper = await mountSuspended(DayColumn, {
      props: { day: makeDay(), today: '2026-10-19', readOnly: false, currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="today-dot"]').exists()).toBe(true)
  })

  it('keeps a weekend day insertable', async () => {
    const wrapper = await mountSuspended(DayColumn, {
      props: {
        day: makeDay({ date: '2026-10-24', dayName: 'Sat', dayOfWeek: 6, isWeekend: true, records: [] }),
        today: null,
        readOnly: false,
        currencySymbol: '$',
      },
    })

    const button = wrapper.find('[data-testid="add-record-2026-10-24"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('Log Weekend')
  })

  it('emits the date when the add button is pressed', async () => {
    const wrapper = await mountSuspended(DayColumn, {
      props: { day: makeDay(), today: null, readOnly: false, currencySymbol: '$' },
    })

    await wrapper.find('[data-testid="add-record-2026-10-19"]').trigger('click')

    expect(wrapper.emitted('add')).toEqual([['2026-10-19']])
  })

  it('offers no add button on a closed week', async () => {
    const wrapper = await mountSuspended(DayColumn, {
      props: { day: makeDay(), today: null, readOnly: true, currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="add-record-2026-10-19"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Week closed')
  })

  it('forwards the record actions from its cards', async () => {
    const wrapper = await mountSuspended(DayColumn, {
      props: { day: makeDay(), today: null, readOnly: false, currencySymbol: '$' },
    })

    await wrapper.find('[data-testid="delete-record-1"]').trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})

describe('TargetBanner', () => {
  it('states the hours against the goal', async () => {
    const wrapper = await mountSuspended(TargetBanner, {
      props: { totals: makeTotals(), currencySymbol: '$' },
    })

    expect(wrapper.text()).toContain('34.5 / 40.0 hrs logged this week')
    expect(wrapper.text()).toContain('$4180.00')
    expect(wrapper.text()).toContain('12 records')
  })

  it('flags a week that is below target', async () => {
    const wrapper = await mountSuspended(TargetBanner, {
      props: { totals: makeTotals(), currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="target-banner"]').attributes('data-below-target')).toBe('true')
    expect(wrapper.find('[data-testid="below-target-badge"]').text()).toContain('5.5 hrs below target')
  })

  it('shows no shortfall badge when the target was met', async () => {
    const wrapper = await mountSuspended(TargetBanner, {
      props: { totals: makeTotals({ belowTarget: false, hoursBelowTarget: 0, totalHours: 42 }), currencySymbol: '$' },
    })

    expect(wrapper.find('[data-testid="below-target-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="target-banner"]').attributes('data-below-target')).toBe('false')
  })

  it('exposes the progress to assistive technology', async () => {
    const wrapper = await mountSuspended(TargetBanner, {
      props: { totals: makeTotals(), currencySymbol: '$' },
    })

    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.exists()).toBe(true)
    expect(Number(bar.attributes('aria-valuenow'))).toBeCloseTo(86.25, 2)
    expect(bar.attributes('aria-label')).toContain('Weekly target progress')
  })
})
