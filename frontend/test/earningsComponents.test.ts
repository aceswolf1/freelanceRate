// @vitest-environment nuxt
/**
 * Behaviour tests for the earnings UI:
 * `app/components/earnings/EarningsFilters.vue` and
 * `app/components/earnings/EarningsTable.vue`.
 *
 * Scenarios covered:
 * - the filter bar emits the preset the user pressed and marks the active one;
 * - the resolved range is spelled out (fully bounded, open ended, "all time");
 * - an inverted range is flagged inline;
 * - a custom range picked on the calendar is emitted as ISO dates;
 * - the ledger renders one row per bucket with money, the totals footer, the
 *   empty state and the standalone bucket.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import type { EarningsRow } from '~/types/api'
import EarningsFilters from '~/components/earnings/EarningsFilters.vue'
import EarningsTable from '~/components/earnings/EarningsTable.vue'

function makeRow(overrides: Partial<EarningsRow> = {}): EarningsRow {
  return {
    id: 1,
    name: 'E-Commerce Storefront',
    hours: 15.5,
    gross: 2015,
    fees: 20.15,
    net: 1994.85,
    ...overrides,
  }
}

const filterProps = {
  from: '2026-10-19',
  to: '2026-10-25',
  groupBy: 'project' as const,
  preset: 'week' as const,
  pending: false,
  invalidRange: false,
  resolvedFrom: '2026-10-19',
  resolvedTo: '2026-10-25',
}

describe('EarningsFilters', () => {
  it('offers one button per range preset', async () => {
    const wrapper = await mountSuspended(EarningsFilters, { props: filterProps })

    expect(wrapper.find('[data-testid="range-preset-week"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="range-preset-month"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="range-preset-year"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="range-preset-all"]').exists()).toBe(true)
  })

  it('emits the preset the user pressed', async () => {
    const wrapper = await mountSuspended(EarningsFilters, { props: filterProps })

    await wrapper.find('[data-testid="range-preset-year"]').trigger('click')

    expect(wrapper.emitted('apply-preset')).toEqual([['year']])
  })

  it('marks the active preset as pressed and leaves the others unpressed', async () => {
    const wrapper = await mountSuspended(EarningsFilters, { props: filterProps })

    expect(wrapper.find('[data-testid="range-preset-week"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="range-preset-year"]').attributes('aria-pressed')).toBe('false')
  })

  it('spells out the resolved range', async () => {
    const wrapper = await mountSuspended(EarningsFilters, { props: filterProps })

    expect(wrapper.find('[data-testid="earnings-resolved-range"]').text()).toContain('19-10-2026')
    expect(wrapper.find('[data-testid="earnings-resolved-range"]').text()).toContain('25-10-2026')
  })

  it('marks an open-ended range as such', async () => {
    const wrapper = await mountSuspended(EarningsFilters, {
      props: { ...filterProps, resolvedFrom: '2026-10-19', resolvedTo: '' },
    })

    expect(wrapper.find('[data-testid="earnings-resolved-range"]').text()).toContain('(open ended)')
  })

  it('says so when the range is unbounded on both ends', async () => {
    const wrapper = await mountSuspended(EarningsFilters, {
      props: { ...filterProps, resolvedFrom: '', resolvedTo: '' },
    })

    expect(wrapper.find('[data-testid="earnings-resolved-range"]').text()).toContain('All logged time')
  })

  it('flags an inverted range inline', async () => {
    const wrapper = await mountSuspended(EarningsFilters, {
      props: { ...filterProps, invalidRange: true },
    })

    const alert = wrapper.find('[data-testid="range-error"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('Invalid date range')
  })

  it('shows no range error when the range is valid', async () => {
    const wrapper = await mountSuspended(EarningsFilters, { props: filterProps })

    expect(wrapper.find('[data-testid="range-error"]').exists()).toBe(false)
  })

  it('emits a hand-picked range as ISO dates', async () => {
    const wrapper = await mountSuspended(EarningsFilters, { props: filterProps })

    // The picker model is a two-value range; setting it is the same path the
    // DatePicker takes when the user picks two days.
    ;(wrapper.vm as unknown as { pickerValue: Date[] | null }).pickerValue = [
      new Date(2026, 0, 5),
      new Date(2026, 0, 20),
    ]
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:range')).toEqual([[{ from: '2026-01-05', to: '2026-01-20' }]])
  })

  it('ignores an incomplete picker selection', async () => {
    const wrapper = await mountSuspended(EarningsFilters, { props: filterProps })

    ;(wrapper.vm as unknown as { pickerValue: Date[] | null }).pickerValue = [new Date(2026, 0, 5)]
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:range')).toBeUndefined()
  })

  it('has no picker value when only one bound of the range is known', async () => {
    const wrapper = await mountSuspended(EarningsFilters, {
      props: { ...filterProps, from: '2026-10-19', to: '' },
    })

    expect((wrapper.vm as unknown as { pickerValue: Date[] | null }).pickerValue).toBeNull()
  })
})

describe('EarningsTable', () => {
  const totals = { hours: 32.5, gross: 3920, fees: 36.83, net: 3883.17 }

  it('renders one row per bucket with its money', async () => {
    const wrapper = await mountSuspended(EarningsTable, {
      props: {
        rows: [makeRow(), makeRow({ id: 3, name: 'Video Streaming Mobile App', hours: 14.5, gross: 1667.5, fees: 16.68, net: 1650.82 })],
        totals,
        groupBy: 'project',
        currencySymbol: '$',
        loading: false,
      },
    })

    const text = wrapper.text()
    expect(text).toContain('E-Commerce Storefront')
    expect(text).toContain('Video Streaming Mobile App')
    expect(text).toContain('2015.00')
    expect(text).toContain('1994.85')
  })

  it('labels the first column after the grouping', async () => {
    const byProject = await mountSuspended(EarningsTable, {
      props: { rows: [makeRow()], totals, groupBy: 'project', currencySymbol: '$', loading: false },
    })
    expect(byProject.text()).toContain('Project')

    const byClient = await mountSuspended(EarningsTable, {
      props: { rows: [makeRow()], totals, groupBy: 'client', currencySymbol: '$', loading: false },
    })
    expect(byClient.text()).toContain('Client')
  })

  it('marks the standalone bucket', async () => {
    const wrapper = await mountSuspended(EarningsTable, {
      props: {
        rows: [makeRow({ id: null, name: 'No client' })],
        totals,
        groupBy: 'client',
        currencySymbol: '$',
        loading: false,
      },
    })

    expect(wrapper.text()).toContain('Standalone work')
  })

  it('renders the totals footer', async () => {
    const wrapper = await mountSuspended(EarningsTable, {
      props: { rows: [makeRow()], totals, groupBy: 'project', currencySymbol: '$', loading: false },
    })

    const footer = wrapper.find('[data-testid="earnings-totals-footer"]')
    expect(footer.exists()).toBe(true)
    expect(footer.text()).toContain('Totals')
    expect(wrapper.find('[data-testid="earnings-total-net"]').text()).toContain('3883.17')
  })

  it('shows an empty state when the range holds no earnings', async () => {
    const wrapper = await mountSuspended(EarningsTable, {
      props: {
        rows: [],
        totals: { hours: 0, gross: 0, fees: 0, net: 0 },
        groupBy: 'project',
        currencySymbol: '$',
        loading: false,
      },
    })

    expect(wrapper.text()).toContain('No earnings in this range')
  })

  it('uses the currency symbol it was given', async () => {
    const wrapper = await mountSuspended(EarningsTable, {
      props: { rows: [makeRow()], totals, groupBy: 'project', currencySymbol: '€', loading: false },
    })

    expect(wrapper.text()).toContain('€')
  })
})
