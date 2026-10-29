// @vitest-environment nuxt
/**
 * Behaviour tests for the invoice generator page (`app/pages/invoices.vue`).
 *
 * Scenarios covered:
 * - the page titles itself after the week it loaded and shows the money tiles
 *   summed from the buckets actually on screen;
 * - an open week is a live preview only — the page says so and offers no
 *   download;
 * - a week below the target warns but never blocks;
 * - an empty week says there is nothing to invoice;
 * - a failed load is surfaced inline;
 * - generating below the target asks for confirmation first.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { InvoicePreview, Week } from '~/types/api'
import { fromPreviewRow } from '~/composables/useInvoices'
import InvoicesPage from '~/pages/invoices.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const { confirmRequire } = vi.hoisted(() => ({ confirmRequire: vi.fn() }))
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequire }),
}))

function makeWeek(overrides: Partial<Week> = {}): Week {
  return {
    id: 1,
    startDate: '2026-10-19',
    endDate: '2026-10-25',
    status: 'open',
    closedAt: null,
    label: 'Week 43: 19-10-2026 – 25-10-2026',
    isoWeek: 43,
    days: [],
    totals: {
      totalHours: 34.5,
      projectedGross: 4180,
      targetHours: 40,
      belowTarget: true,
      hoursBelowTarget: 5.5,
      clientCount: 1,
      recordCount: 12,
      byProject: [],
      byClient: [],
    },
    invoiceCount: 0,
    ...overrides,
  }
}

function makePreview(overrides: Partial<InvoicePreview> = {}): InvoicePreview {
  return {
    weekId: 1,
    periodStart: '2026-10-19',
    periodEnd: '2026-10-25',
    status: 'open',
    canGenerate: false,
    currencySymbol: '$',
    totals: {
      totalHours: 17.5,
      projectedGross: 2275,
      targetHours: 40,
      belowTarget: true,
      hoursBelowTarget: 22.5,
      clientCount: 1,
      recordCount: 12,
      byProject: [],
      byClient: [],
    },
    warnings: [{ code: 'BELOW_TARGET', message: '17.5 / 40 hrs, -22.5 below target' }],
    invoices: [
      fromPreviewRow({
        clientId: 1,
        clientName: 'Acme Corp',
        contactName: null,
        contactEmail: 'billing@acme.example',
        ccEmail: null,
        platformCompany: 'Payoneer',
        feePercent: 1,
        feeFlat: 0,
        totalHours: 17.5,
        gross: 2275,
        feeAmount: 22.75,
        net: 2252.25,
        lines: [],
        subtotals: [],
      }, '$'),
    ],
    ...overrides,
  }
}

async function fetchMock() {
  const { $fetch } = await import('#build/fetch')
  const mock = vi.mocked($fetch)
  mock.mockReset()
  return mock
}

function routeApi(mock: ReturnType<typeof vi.fn>, preview: InvoicePreview = makePreview()): void {
  mock.mockImplementation((url: string) => {
    const target = String(url)
    if (target.includes('/invoice-preview')) {
      return Promise.resolve({ success: true, data: preview }) as never
    }
    if (target.includes('/invoices')) {
      return Promise.resolve({ success: true, data: [] }) as never
    }
    if (target.endsWith('/weeks/current')) {
      return Promise.resolve({ success: true, data: makeWeek() }) as never
    }
    if (target.endsWith('/clients')) {
      return Promise.resolve({ success: true, data: [] }) as never
    }
    return Promise.resolve({ success: true, data: [] }) as never
  })
}

describe('the invoice generator page', () => {
  beforeEach(async () => {
    clearNuxtState()
    document.body.innerHTML = ''
    confirmRequire.mockReset()
    await fetchMock()
  })

  it('titles itself after the week it loaded', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(InvoicesPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Generate Invoices for Week 43')

    wrapper.unmount()
  })

  it('sums the money tiles from the buckets on screen', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(InvoicesPage)
    await flushPromises()
    await nextTick()

    const text = wrapper.text()
    expect(text).toContain('Gross Billed')
    expect(text).toContain('$2275.00')
    expect(text).toContain('$2252.25')
    expect(text).toContain('1 client bucket')

    wrapper.unmount()
  })

  it('says an open week is only a preview', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(InvoicesPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Close the week to generate invoices')
    expect(wrapper.text()).toContain('nothing has been written')

    wrapper.unmount()
  })

  it('warns when the week is below the target, without blocking', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(InvoicesPage)
    await flushPromises()
    await nextTick()

    const warning = wrapper.find('[data-testid="below-target-warning"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('below target')

    wrapper.unmount()
  })

  it('says there is nothing to invoice for an empty week', async () => {
    const mock = await fetchMock()
    routeApi(mock, makePreview({ invoices: [], totals: { ...makePreview().totals, belowTarget: false, hoursBelowTarget: 0 } }))

    const wrapper = await mountSuspended(InvoicesPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Nothing to invoice for this week yet.')

    wrapper.unmount()
  })

  it('shows a load error when the week cannot be read', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new Error('service unavailable'))

    const wrapper = await mountSuspended(InvoicesPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Could not load this week')

    wrapper.unmount()
  })

  it('asks for confirmation before generating a week that is below target', async () => {
    const mock = await fetchMock()
    routeApi(mock, makePreview({ status: 'closed', canGenerate: true }))
    mock.mockImplementation((url: string) => {
      const target = String(url)
      if (target.includes('/invoice-preview')) {
        return Promise.resolve({ success: true, data: makePreview({ status: 'closed', canGenerate: true }) }) as never
      }
      if (target.includes('/invoices')) {
        return Promise.resolve({ success: true, data: [] }) as never
      }
      if (target.endsWith('/weeks/current')) {
        return Promise.resolve({ success: true, data: makeWeek({ status: 'closed', closedAt: '2026-10-25T23:59:00.000Z' }) }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })

    const wrapper = await mountSuspended(InvoicesPage)
    await flushPromises()
    await nextTick()

    await wrapper.find('[data-testid="generate-invoices"]').trigger('click')
    await nextTick()

    expect(confirmRequire).toHaveBeenCalledTimes(1)
    const request = confirmRequire.mock.calls[0]![0] as { message: string, acceptLabel: string }
    expect(request.message).toContain('This week is under target')
    expect(request.acceptLabel).toBe('Generate anyway')

    wrapper.unmount()
  })
})
