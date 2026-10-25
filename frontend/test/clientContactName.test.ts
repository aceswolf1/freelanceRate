// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Client } from '~/types/api'
import ClientDialog from '~/components/clients/ClientDialog.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

/** PrimeVue's Dialog teleports to `document.body`, so query the document. */
function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

const acme: Client = {
  id: 1,
  name: 'Acme Corp',
  contactName: 'Jane Doe',
  contactEmail: 'billing@acme.example',
  ccEmail: null,
  billingHour: 130,
  paymentPlatformId: null,
  paymentPlatform: null,
  projectCount: 0,
  totalHours: 0,
  totalGross: 0,
  notes: null,
  createdAt: '2026-10-22T18:04:10.301Z',
  updatedAt: '2026-10-22T18:04:10.301Z',
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await nextTick()
}

function typeInto(selector: string, value: string): void {
  const input = q<HTMLInputElement>(selector)
  expect(input).not.toBeNull()
  input!.value = value
  input!.dispatchEvent(new Event('input', { bubbles: true }))
}

async function captureBodies(): Promise<unknown[]> {
  const bodies: unknown[] = []
  const { $fetch } = await import('#build/fetch')
  vi.mocked($fetch).mockImplementation((url: string, options?: { body?: unknown }) => {
    if (options?.body) {
      bodies.push(options.body)
      return Promise.resolve({ success: true, data: { ...acme, ...(options.body as object) } }) as never
    }
    // Reads (e.g. the payment-platform select) are list endpoints.
    return Promise.resolve({ success: true, data: String(url).endsWith('/clients/1') ? acme : [] }) as never
  })
  return bodies
}

describe('Client contact name', () => {
  beforeEach(() => {
    clearNuxtState()
    document.body.innerHTML = ''
  })

  it('renders an optional, labelled Contact Name field', async () => {
    const wrapper = await mountSuspended(ClientDialog, { props: { visible: true, client: null } })
    await settle()

    const label = q<HTMLLabelElement>('label[for="client-contact-name"]')
    expect(label?.textContent).toContain('Contact Name')
    expect(q('#client-contact-name')).not.toBeNull()

    wrapper.unmount()
  })

  it('prefills the contact name when editing', async () => {
    const wrapper = await mountSuspended(ClientDialog, { props: { visible: true, client: acme } })
    await settle()

    expect(q<HTMLInputElement>('#client-contact-name')?.value).toBe('Jane Doe')

    wrapper.unmount()
  })

  it('sends the trimmed contact name on save', async () => {
    const bodies = await captureBodies()
    const wrapper = await mountSuspended(ClientDialog, { props: { visible: true, client: acme } })
    await settle()

    typeInto('#client-contact-name', '  John Smith  ')
    await settle()
    q<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()

    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ contactName: 'John Smith' })

    wrapper.unmount()
  })

  it('sends null when the contact name is cleared', async () => {
    const bodies = await captureBodies()
    const wrapper = await mountSuspended(ClientDialog, { props: { visible: true, client: acme } })
    await settle()

    typeInto('#client-contact-name', '   ')
    await settle()
    q<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()

    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ contactName: null })

    wrapper.unmount()
  })
})
