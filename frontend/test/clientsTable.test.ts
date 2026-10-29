// @vitest-environment nuxt
/**
 * Behaviour tests for `app/components/clients/ClientsTable.vue` (R1).
 *
 * Scenarios covered:
 * - the directory renders one row per client with its display id, contact
 *   details, billing hour, payout rail and lifetime totals;
 * - a client with no secondary contact shows an em dash rather than a blank;
 * - the payout rail spells out the fee the platform absorbs (percent, flat, or
 *   both) and says so when there is no platform at all;
 * - the row actions emit `edit` and `remove` with the client they belong to;
 * - an empty directory shows the empty state.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import type { Client } from '~/types/api'
import ClientsTable from '~/components/clients/ClientsTable.vue'

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    name: 'Acme Corp',
    contactName: 'Robin Banks',
    contactEmail: 'billing@acme.example',
    ccEmail: 'finance@acme.example',
    billingHour: 130,
    paymentPlatformId: null,
    paymentPlatform: null,
    projectCount: 2,
    totalHours: 34.5,
    totalGross: 4180,
    notes: null,
    createdAt: '2026-10-22T18:04:10.402Z',
    updatedAt: '2026-10-22T18:04:10.402Z',
    ...overrides,
  }
}

describe('ClientsTable', () => {
  it('renders one row per client with its display id', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: {
        clients: [makeClient(), makeClient({ id: 2, name: 'Starlight Media' })],
        loading: false,
      },
    })

    expect(wrapper.find('[data-testid="client-id-1"]').text()).toBe('#CLI-001')
    expect(wrapper.find('[data-testid="client-id-2"]').text()).toBe('#CLI-002')
    expect(wrapper.text()).toContain('Acme Corp')
    expect(wrapper.text()).toContain('Starlight Media')
  })

  it('shows the contact name and both email addresses', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: { clients: [makeClient()], loading: false },
    })

    expect(wrapper.find('[data-testid="client-contact-name"]').text()).toBe('Robin Banks')
    expect(wrapper.text()).toContain('billing@acme.example')
    expect(wrapper.text()).toContain('finance@acme.example')
    expect(wrapper.find('a[href="mailto:billing@acme.example"]').exists()).toBe(true)
  })

  it('shows an em dash when there is no secondary contact', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: { clients: [makeClient({ ccEmail: null })], loading: false },
    })

    expect(wrapper.text()).not.toContain('finance@acme.example')
    expect(wrapper.text()).toContain('—')
  })

  it('shows the billing hour and the lifetime totals', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: { clients: [makeClient()], loading: false },
    })

    expect(wrapper.text()).toContain('$130.00')
    expect(wrapper.text()).toContain('/hr')
    expect(wrapper.text()).toContain('34.5h')
    expect(wrapper.text()).toContain('$4180.00')
  })

  it('counts the client projects', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: { clients: [makeClient({ projectCount: 1 })], loading: false },
    })

    expect(wrapper.text()).toContain('1 project')
  })

  it('says so when the client has no payment platform', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: { clients: [makeClient()], loading: false },
    })

    expect(wrapper.text()).toContain('No payment platform')
  })

  it('spells out a percentage-only fee and marks it as absorbed', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: {
        clients: [makeClient({
          paymentPlatform: { id: 1, company: 'Payoneer', feePercent: 1, feeFlat: 0, createdAt: '2026-10-01T00:00:00.000Z' },
        })],
        loading: false,
      },
    })

    expect(wrapper.text()).toContain('Payoneer (1%, absorbed)')
  })

  it('spells out a flat-only fee', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: {
        clients: [makeClient({
          paymentPlatform: { id: 2, company: 'Wise', feePercent: 0, feeFlat: 15, createdAt: '2026-10-01T00:00:00.000Z' },
        })],
        loading: false,
      },
    })

    expect(wrapper.text()).toContain('Wise ($15.00 flat, absorbed)')
  })

  it('spells out a percent + flat fee', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: {
        clients: [makeClient({
          paymentPlatform: { id: 3, company: 'PayPal', feePercent: 2.5, feeFlat: 0.5, createdAt: '2026-10-01T00:00:00.000Z' },
        })],
        loading: false,
      },
    })

    expect(wrapper.text()).toContain('PayPal (2.5% + $0.50 flat, absorbed)')
  })

  it('names the platform on its own when it charges no fee', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: {
        clients: [makeClient({
          paymentPlatform: { id: 4, company: 'Bank Transfer', feePercent: 0, feeFlat: 0, createdAt: '2026-10-01T00:00:00.000Z' },
        })],
        loading: false,
      },
    })

    expect(wrapper.text()).toContain('Bank Transfer')
    expect(wrapper.text()).not.toContain('absorbed')
  })

  it('emits edit with the client that was clicked', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: { clients: [makeClient()], loading: false },
    })

    await wrapper.find('[data-testid="edit-client-1"]').trigger('click')

    const emitted = wrapper.emitted('edit')
    expect(emitted).toHaveLength(1)
    expect((emitted![0]![0] as Client).name).toBe('Acme Corp')
  })

  it('emits remove with the client that was clicked', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: { clients: [makeClient()], loading: false },
    })

    await wrapper.find('[data-testid="delete-client-1"]').trigger('click')

    const emitted = wrapper.emitted('remove')
    expect(emitted).toHaveLength(1)
    expect((emitted![0]![0] as Client).id).toBe(1)
  })

  it('shows the empty state when there are no clients', async () => {
    const wrapper = await mountSuspended(ClientsTable, {
      props: { clients: [], loading: false },
    })

    expect(wrapper.text()).toContain('No clients yet')
  })
})
