// @vitest-environment nuxt
/**
 * Behaviour tests for the shared presentational components:
 * `app/components/common/StatCard.vue` and `app/components/common/PlaceholderState.vue`.
 *
 * Scenarios covered:
 * - StatCard renders its label, value and optional hint, and only shows the
 *   icon badge when an icon is supplied.
 * - StatCard applies the tone colour to the value so a positive/warning tile
 *   reads differently from a neutral one.
 * - PlaceholderState renders the title, description and status, and forwards
 *   the optional header slot.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import PlaceholderState from '~/components/common/PlaceholderState.vue'
import StatCard from '~/components/common/StatCard.vue'

describe('StatCard', () => {
  it('renders the label and the value', async () => {
    const wrapper = await mountSuspended(StatCard, {
      props: { label: 'Total Hours', value: '34.5' },
    })

    expect(wrapper.text()).toContain('Total Hours')
    expect(wrapper.text()).toContain('34.5')
  })

  it('shows the hint only when one is given', async () => {
    const withHint = await mountSuspended(StatCard, {
      props: { label: 'Total Hours', value: '34.5', hint: 'of a 40 h target' },
    })
    expect(withHint.text()).toContain('of a 40 h target')

    const withoutHint = await mountSuspended(StatCard, {
      props: { label: 'Total Hours', value: '34.5' },
    })
    expect(withoutHint.text()).not.toContain('of a 40 h target')
  })

  it('renders no icon badge when no icon is supplied', async () => {
    const wrapper = await mountSuspended(StatCard, {
      props: { label: 'Total Hours', value: '34.5' },
    })

    expect(wrapper.find('.pi').exists()).toBe(false)
  })

  it('renders the icon badge when an icon is supplied', async () => {
    const wrapper = await mountSuspended(StatCard, {
      props: { label: 'Total Hours', value: '34.5', icon: 'pi-clock' },
    })

    const icon = wrapper.find('.pi-clock')
    expect(icon.exists()).toBe(true)
    // The badge is decorative — it must stay out of the accessibility tree.
    expect(icon.element.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('colours the value according to the tone', async () => {
    const positive = await mountSuspended(StatCard, {
      props: { label: 'Net', value: '$3,883.17', tone: 'positive' },
    })
    expect(positive.html()).toContain('text-tertiary')

    const warning = await mountSuspended(StatCard, {
      props: { label: 'Below target', value: '5.5 h', tone: 'warning' },
    })
    expect(warning.html()).toContain('text-warning')

    const neutral = await mountSuspended(StatCard, {
      props: { label: 'Clients', value: '2' },
    })
    expect(neutral.html()).toContain('text-on-surface')
  })
})

describe('PlaceholderState', () => {
  it('renders the icon, title, description and status', async () => {
    const wrapper = await mountSuspended(PlaceholderState, {
      props: {
        icon: 'pi-chart-bar',
        title: 'Earnings',
        description: 'Reports land here.',
        status: 'Coming soon',
      },
    })

    expect(wrapper.text()).toContain('Earnings')
    expect(wrapper.text()).toContain('Reports land here.')
    expect(wrapper.text()).toContain('Coming soon')
    expect(wrapper.find('.pi-chart-bar').exists()).toBe(true)
  })

  it('renders the optional header slot', async () => {
    const wrapper = await mountSuspended(PlaceholderState, {
      props: {
        icon: 'pi-chart-bar',
        title: 'Earnings',
        description: 'Reports land here.',
        status: 'Coming soon',
      },
      slots: { header: '<h1>Reports</h1>' },
    })

    expect(wrapper.text()).toContain('Reports')
  })
})
