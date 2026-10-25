// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Settings } from '~/types/api'
import SettingsPage from '~/pages/settings.vue'
import PaymentPlatformsTable from '~/components/settings/PaymentPlatformsTable.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const realSettings: Settings = {
  id: 1,
  displayName: 'Alex Morgan',
  weeklyTargetHours: 40,
  currencySymbol: '$',
  invoicePrefix: 'INV',
  emailShowRate: false,
  emailShowGross: false,
  emailShowFee: false,
  updatedAt: '2026-10-22T18:04:11.001Z',
}

function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

/** `mountSuspended` mounts into a detached element, so page content is queried on the wrapper. */
function inputValue(wrapper: { find: (s: string) => { element: unknown } }, selector: string): string {
  return (wrapper.find(selector).element as HTMLInputElement).value
}

/**
 * GAP-007 regression.
 *
 * The layout's user card calls `useProfile().load()` before the settings page
 * does, so `pending` was already true when the page issued its forced load.
 * `load()` returned the *fallback* settings ("Consultant") instead of awaiting
 * the request already in flight, the form hydrated from that fallback, and
 * pressing Save wrote "Consultant" over the stored "Alex Morgan".
 */
describe('GAP-007 — the settings form is seeded with the real values', () => {
  beforeEach(() => {
    clearNuxtState()
    document.body.innerHTML = ''
  })

  it('a forced load awaits an in-flight request instead of returning the fallback', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    let release: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      release = resolve
    })

    fetchMock.mockImplementation(() => pending as never)

    const { useSettings } = await import('~/composables/useSettings')
    const { settings, loaded } = useSettings()

    // Two concurrent loads, exactly like the user card and the page.
    const first = useSettings().load({ force: true })
    const second = useSettings().load({ force: true })

    // Nothing has resolved yet, so the state is still the fallback…
    expect(settings.value.displayName).toBe('Consultant')
    expect(loaded.value).toBe(false)

    release({ success: true, data: realSettings })
    await Promise.all([first, second])

    // …but both callers must receive the *real* values.
    expect(settings.value.displayName).toBe('Alex Morgan')
    expect(loaded.value).toBe(true)
    await expect(first).resolves.toMatchObject({ displayName: 'Alex Morgan' })
    await expect(second).resolves.toMatchObject({ displayName: 'Alex Morgan' })
  })

  it('the form shows the API value, not the fallback, and Save is enabled', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith('/settings')) {
        return Promise.resolve({ success: true, data: realSettings }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })

    const wrapper = await mountSuspended(SettingsPage)
    await nextTick()

    // The input carries the real name — never the fallback.
    expect(wrapper.find('#settings-name').exists()).toBe(true)
    expect(inputValue(wrapper, '#settings-name')).toBe('Alex Morgan')

    // And Save is enabled, because the real settings have loaded.
    const saveButton = wrapper.find('[data-testid="save-settings"]')
    expect((saveButton.element as HTMLButtonElement).disabled).toBe(false)

    wrapper.unmount()
  })

  it('keeps Save disabled when the real settings never load', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    // The API is down: the settings never load, so the form is still seeded
    // with the fallback and Save must stay disabled — a fallback-seeded form
    // must never be written back over the stored values.
    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith('/settings')) {
        return Promise.reject(new Error('network down')) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })

    const wrapper = await mountSuspended(SettingsPage)
    await nextTick()

    const saveButton = wrapper.find('[data-testid="save-settings"]')
    expect((saveButton.element as HTMLButtonElement).disabled).toBe(true)

    wrapper.unmount()
  })

  it('never overwrites the stored name with the fallback', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    const putBodies: unknown[] = []
    fetchMock.mockImplementation((url: string, options?: { body?: unknown }) => {
      if (String(url).endsWith('/settings') && options?.body) {
        putBodies.push(options.body)
        return Promise.resolve({ success: true, data: { ...realSettings, ...(options.body as object) } }) as never
      }
      if (String(url).endsWith('/settings')) {
        return Promise.resolve({ success: true, data: realSettings }) as never
      }
      // Payment platforms: a list endpoint.
      return Promise.resolve({ success: true, data: [] }) as never
    })

    const wrapper = await mountSuspended(SettingsPage)
    await nextTick()
    await nextTick()
    await nextTick()

    expect(inputValue(wrapper, '#settings-name')).toBe('Alex Morgan')

    // Save — the payload must carry the real name.
    ;(wrapper.find('[data-testid="save-settings"]').element as HTMLButtonElement).click()
    await nextTick()
    await nextTick()

    expect(putBodies.length).toBe(1)
    expect((putBodies[0] as { displayName: string }).displayName).toBe('Alex Morgan')

    wrapper.unmount()
  })
})

/**
 * GAP-006 regression.
 *
 * `<Column header="Fee on {{formatMoney(1000, currencySymbol)}}">` rendered the
 * braces verbatim, because a static attribute is not interpolated.
 */
describe('GAP-006 — the fee column header is interpolated', () => {
  beforeEach(() => {
    clearNuxtState()
    document.body.innerHTML = ''
  })

  it('renders the header text, not the template braces', async () => {
    const wrapper = await mountSuspended(PaymentPlatformsTable, {
      props: { platforms: [], loading: false },
    })
    await nextTick()

    const header = wrapper.findAll('th').find(th => th.text().includes('Fee on'))
    expect(header).toBeDefined()
    expect(header!.text()).toContain('Fee on $1000.00')
    expect(header!.text()).not.toContain('{{')
    expect(header!.text()).not.toContain('}}')

    wrapper.unmount()
  })
})

describe('Email content options', () => {
  beforeEach(() => {
    clearNuxtState()
    document.body.innerHTML = ''
  })

  async function mockApi(stored: Settings, putBodies: unknown[]): Promise<void> {
    const { $fetch } = await import('#build/fetch')
    vi.mocked($fetch).mockImplementation((url: string, options?: { body?: unknown }) => {
      if (String(url).endsWith('/settings') && options?.body) {
        putBodies.push(options.body)
        return Promise.resolve({ success: true, data: { ...stored, ...(options.body as object) } }) as never
      }
      if (String(url).endsWith('/settings')) {
        return Promise.resolve({ success: true, data: stored }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })
  }

  function checked(wrapper: { find: (s: string) => { element: unknown } }, id: string): boolean {
    return (wrapper.find(`#${id}`).element as HTMLInputElement).checked
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i += 1) await nextTick()
  }

  it('renders the three switches, all off by default', async () => {
    await mockApi(realSettings, [])
    const wrapper = await mountSuspended(SettingsPage)
    await settle()

    expect(wrapper.find('[data-testid="email-content-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Show rate')
    expect(wrapper.text()).toContain('Show gross')
    expect(wrapper.text()).toContain('Show fee')
    expect(checked(wrapper, 'settings-email-rate')).toBe(false)
    expect(checked(wrapper, 'settings-email-gross')).toBe(false)
    expect(checked(wrapper, 'settings-email-fee')).toBe(false)

    wrapper.unmount()
  })

  it('reflects stored values', async () => {
    await mockApi({ ...realSettings, emailShowGross: true }, [])
    const wrapper = await mountSuspended(SettingsPage)
    await settle()

    expect(checked(wrapper, 'settings-email-rate')).toBe(false)
    expect(checked(wrapper, 'settings-email-gross')).toBe(true)
    expect(checked(wrapper, 'settings-email-fee')).toBe(false)

    wrapper.unmount()
  })

  it('saves a toggled option with Save All Changes', async () => {
    const putBodies: unknown[] = []
    await mockApi(realSettings, putBodies)
    const wrapper = await mountSuspended(SettingsPage)
    await settle()

    await wrapper.find('#settings-email-rate').setValue(true)
    await settle()
    ;(wrapper.find('[data-testid="save-settings"]').element as HTMLButtonElement).click()
    await settle()

    expect(putBodies.length).toBe(1)
    expect(putBodies[0]).toMatchObject({
      emailShowRate: true,
      emailShowGross: false,
      emailShowFee: false,
      displayName: 'Alex Morgan',
    })

    wrapper.unmount()
  })
})
