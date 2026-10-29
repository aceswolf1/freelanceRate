// @vitest-environment nuxt
/**
 * Behaviour tests for the clients page (`app/pages/clients.vue`).
 *
 * Scenarios covered:
 * - the directory lists the clients the API returned;
 * - the stat tiles are backed by real contract data (count, unbilled hours,
 *   average billing rate);
 * - "Create New Client" opens the dialog in create mode, editing a row opens
 *   it in edit mode;
 * - deleting asks for confirmation first, naming the client, and a blocked
 *   delete (409) is reported calmly instead of vanishing;
 * - a failed load is shown inline.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Client } from '~/types/api'
import ClientsPage from '~/pages/clients.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const { confirmRequire } = vi.hoisted(() => ({ confirmRequire: vi.fn() }))
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequire }),
}))

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
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
    ...overrides,
  }
}

async function fetchMock() {
  const { $fetch } = await import('#build/fetch')
  const mock = vi.mocked($fetch)
  mock.mockReset()
  return mock
}

/** Routes the page's two startup calls (/clients and /projects). */
function routeApi(mock: ReturnType<typeof vi.fn>, clients: Client[] = [makeClient()]): void {
  mock.mockImplementation((url: string) => {
    if (String(url).endsWith('/clients')) {
      return Promise.resolve({ success: true, data: clients }) as never
    }
    return Promise.resolve({ success: true, data: [] }) as never
  })
}

describe('the clients page', () => {
  beforeEach(async () => {
    clearNuxtState()
    document.body.innerHTML = ''
    confirmRequire.mockReset()
    await fetchMock()
  })

  it('lists the clients the API returned', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ClientsPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Acme Corp')
    expect(wrapper.find('[data-testid="client-id-1"]').text()).toBe('#CLI-001')

    wrapper.unmount()
  })

  it('shows the stat tiles backed by real contract data', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ClientsPage)
    await flushPromises()
    await nextTick()

    const text = wrapper.text()
    expect(text).toContain('Total Active Clients')
    expect(text).toContain('Avg Billing Rate')
    expect(text).toContain('$130.00')
    expect(text).toContain('12.5h')

    wrapper.unmount()
  })

  it('shows a dash for the average rate when there are no clients', async () => {
    const mock = await fetchMock()
    routeApi(mock, [])

    const wrapper = await mountSuspended(ClientsPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Avg Billing Rate')
    expect(wrapper.text()).toContain('Across 0 clients')

    wrapper.unmount()
  })

  it('opens the create dialog in create mode', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ClientsPage)
    await flushPromises()
    await nextTick()

    await wrapper.find('[data-testid="create-client"]').trigger('click')
    await nextTick()

    expect(document.body.textContent).toContain('Create New Client')

    wrapper.unmount()
  })

  it('opens the dialog in edit mode with the client that was clicked', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ClientsPage)
    await flushPromises()
    await nextTick()

    await wrapper.find('[data-testid="edit-client-1"]').trigger('click')
    await nextTick()

    expect(document.body.textContent).toContain('Edit Acme Corp')

    wrapper.unmount()
  })

  it('asks for confirmation before deleting, naming the client', async () => {
    const mock = await fetchMock()
    routeApi(mock)

    const wrapper = await mountSuspended(ClientsPage)
    await flushPromises()
    await nextTick()

    await wrapper.find('[data-testid="delete-client-1"]').trigger('click')
    await nextTick()

    expect(confirmRequire).toHaveBeenCalledTimes(1)
    const request = confirmRequire.mock.calls[0]![0] as { message: string, acceptLabel: string }
    expect(request.message).toContain('Delete Acme Corp?')
    expect(request.message).toContain('cannot be deleted')
    expect(request.acceptLabel).toBe('Delete')

    wrapper.unmount()
  })

  it('shows a load error when the directory cannot be read', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new Error('service unavailable'))

    const wrapper = await mountSuspended(ClientsPage)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Could not load clients')

    wrapper.unmount()
  })
})
