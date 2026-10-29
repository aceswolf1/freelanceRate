// @vitest-environment nuxt
/**
 * Behaviour tests for the projects page (`app/pages/projects.vue`) and the
 * earnings page (`app/pages/earnings.vue`).
 *
 * Scenarios covered:
 * - the projects directory lists the projects and shows the inventory tiles;
 * - the scope filter re-queries the API with the contracted params;
 * - creating, editing and deleting a project go through the dialog and the
 *   delete confirmation;
 * - the earnings ledger renders the rows, the stat tiles and the "not yet
 *   invoiced" block (contract §8.1), and hides that block when there is
 *   nothing unbilled;
 * - a failed load is surfaced inline on both pages.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Client, EarningsReport, Project } from '~/types/api'
import EarningsPage from '~/pages/earnings.vue'
import ProjectsPage from '~/pages/projects.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const { confirmRequire } = vi.hoisted(() => ({ confirmRequire: vi.fn() }))
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequire }),
}))

const acme: Client = {
  id: 1,
  name: 'Acme Corp',
  contactName: null,
  contactEmail: 'billing@acme.example',
  ccEmail: null,
  billingHour: 130,
  paymentPlatformId: null,
  paymentPlatform: null,
  projectCount: 1,
  totalHours: 12.5,
  totalGross: 1625,
  notes: null,
  createdAt: '2026-10-22T18:04:10.402Z',
  updatedAt: '2026-10-22T18:04:10.402Z',
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'E-Commerce Storefront',
    clientId: 1,
    description: null,
    billingHour: null,
    effectiveRate: 130,
    rateSource: 'client',
    standalone: false,
    archived: false,
    client: { id: 1, name: 'Acme Corp', contactEmail: 'billing@acme.example', ccEmail: null, billingHour: 130 },
    createdAt: '2026-10-22T18:04:10.402Z',
    updatedAt: '2026-10-22T18:04:10.402Z',
    ...overrides,
  }
}

function makeReport(overrides: Partial<EarningsReport> = {}): EarningsReport {
  return {
    from: '2026-10-19',
    to: '2026-10-24',
    groupBy: 'project',
    currencySymbol: '$',
    rows: [
      { id: 1, name: 'E-Commerce Storefront', hours: 15.5, gross: 2015, fees: 20.15, net: 1994.85 },
    ],
    totals: { hours: 15.5, gross: 2015, fees: 20.15, net: 1994.85 },
    unbilled: { hours: 15.5, gross: 2015, fees: 20.15, net: 1994.85, weekCount: 1 },
    ...overrides,
  }
}

async function fetchMock() {
  const { $fetch } = await import('#build/fetch')
  const mock = vi.mocked($fetch)
  mock.mockReset()
  return mock
}

describe('the projects page', () => {
  beforeEach(async () => {
    clearNuxtState()
    document.body.innerHTML = ''
    confirmRequire.mockReset()
    await fetchMock()
  })

  function routeApi(mock: ReturnType<typeof vi.fn>, projects: Project[] = [makeProject()]): void {
    mock.mockImplementation((url: string) => {
      if (String(url).endsWith('/projects')) {
        return Promise.resolve({ success: true, data: projects }) as never
      }
      if (String(url).endsWith('/clients')) {
        return Promise.resolve({ success: true, data: [acme] }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })
  }

  it('lists the projects the API returned', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ProjectsPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('E-Commerce Storefront')
    expect(wrapper.find('[data-testid="project-id-1"]').text()).toBe('#PRJ-001')

    wrapper.unmount()
  })

  it('shows the inventory tiles', async () => {
    const mock = await fetchMock()
    routeApi(mock, [
      makeProject(),
      makeProject({ id: 2, name: 'Internal Tools', clientId: null, standalone: true, client: null, billingHour: 90, effectiveRate: 90, rateSource: 'project' }),
    ])

    const wrapper = await mountSuspended(ProjectsPage)
    await flushPromises()
    await nextTick()

    const text = wrapper.text()
    expect(text).toContain('Active Inventory')
    expect(text).toContain('Custom Overrides')
    expect(text).toContain('Standalone Rate')
    expect(text).toContain('1 linked • 1 standalone')

    wrapper.unmount()
  })

  it('re-queries the API when the scope filter changes', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ProjectsPage)
    await flushPromises()
    await nextTick()
    mock.mockClear()

    await wrapper.find('[data-testid="filter-standalone"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/projects'),
      expect.objectContaining({ query: expect.objectContaining({ standalone: 'true' }) }),
    )

    wrapper.unmount()
  })

  it('opens the create dialog and the edit dialog', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ProjectsPage)
    await flushPromises()
    await nextTick()

    await wrapper.find('[data-testid="create-project"]').trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('Create New Project')

    await wrapper.find('[data-testid="edit-project-1"]').trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('Edit E-Commerce Storefront')

    wrapper.unmount()
  })

  it('asks for confirmation before deleting a project', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ProjectsPage)
    await flushPromises()
    await nextTick()

    await wrapper.find('[data-testid="delete-project-1"]').trigger('click')
    await nextTick()

    expect(confirmRequire).toHaveBeenCalledTimes(1)
    const request = confirmRequire.mock.calls[0]![0] as { message: string }
    expect(request.message).toContain('Delete E-Commerce Storefront?')

    wrapper.unmount()
  })

  it('shows a load error when the directory cannot be read', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new Error('service unavailable'))

    const wrapper = await mountSuspended(ProjectsPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Could not load projects')

    wrapper.unmount()
  })
})

describe('the earnings page', () => {
  beforeEach(async () => {
    clearNuxtState()
    document.body.innerHTML = ''
    await fetchMock()
  })

  function routeApi(mock: ReturnType<typeof vi.fn>, report: EarningsReport = makeReport()): void {
    mock.mockImplementation((url: string) => {
      if (String(url).includes('/reports/earnings')) {
        return Promise.resolve({ success: true, data: report }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })
  }

  it('renders the ledger rows and the stat tiles', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(EarningsPage)
    await flushPromises()
    await nextTick()

    const text = wrapper.text()
    expect(text).toContain('E-Commerce Storefront')
    expect(text).toContain('Hours Billed')
    expect(text).toContain('Gross Billed')
    expect(text).toContain('Fees Absorbed')
    expect(text).toContain('Net Realized')
    expect(text).toContain('$2015.00')

    wrapper.unmount()
  })

  it('shows the "not yet invoiced" block when there is unbilled work', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(EarningsPage)
    await flushPromises()
    await nextTick()

    const block = wrapper.find('[data-testid="unbilled-block"]')
    expect(block.exists()).toBe(true)
    expect(block.text()).toContain('Not yet invoiced')
    expect(block.text()).toContain('100% of this range')

    wrapper.unmount()
  })

  it('hides the "not yet invoiced" block when everything is invoiced', async () => {
    const mock = await fetchMock()
    routeApi(mock, makeReport({ unbilled: { hours: 0, gross: 0, fees: 0, net: 0, weekCount: 0 } }))

    const wrapper = await mountSuspended(EarningsPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[data-testid="unbilled-block"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('re-queries the API when a range preset is applied', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(EarningsPage)
    await flushPromises()
    await nextTick()
    mock.mockClear()

    await wrapper.find('[data-testid="range-preset-year"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/reports/earnings'),
      expect.objectContaining({ query: expect.objectContaining({ groupBy: 'project', from: '2026-01-01', to: '2026-12-31' }) }),
    )

    wrapper.unmount()
  })

  it('shows a load error when the report cannot be read', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new Error('service unavailable'))

    const wrapper = await mountSuspended(EarningsPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Could not load earnings')

    wrapper.unmount()
  })
})
