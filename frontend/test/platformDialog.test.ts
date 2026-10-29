// @vitest-environment nuxt
/**
 * Behaviour tests for `app/components/settings/PlatformDialog.vue` (R3).
 *
 * Scenarios covered:
 * - the dialog opens in create mode and in edit mode;
 * - the contracted limits are enforced (company 1–120 chars, percent 0–100,
 *   flat fee not negative);
 * - saving posts the platform, emits `saved` and closes the dialog;
 * - editing patches the platform it was opened with;
 * - a backend validation error is shown inline, field by field.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { clearNuxtState } from '#app'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PaymentPlatform } from '~/types/api'
import PlatformDialog from '~/components/settings/PlatformDialog.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

function makePlatform(overrides: Partial<PaymentPlatform> = {}): PaymentPlatform {
  return {
    id: 1,
    company: 'Payoneer',
    feePercent: 1,
    feeFlat: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

type DialogForm = { company: string, feePercent: number | null, feeFlat: number | null }

const mounted: Array<{ unmount: () => void }> = []

function track<T extends { unmount: () => void }>(wrapper: T): T {
  mounted.push(wrapper)
  return wrapper
}

function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

async function fetchMock() {
  const { $fetch } = await import('#build/fetch')
  const mock = vi.mocked($fetch)
  mock.mockReset()
  return mock
}

describe('PlatformDialog', () => {
  beforeEach(async () => {
    clearNuxtState()
    await fetchMock()
  })

  afterEach(() => {
    for (const wrapper of mounted.splice(0)) {
      wrapper.unmount()
    }
    document.body.innerHTML = ''
  })

  it('opens in create mode', async () => {
    const wrapper = await track(await mountSuspended(PlatformDialog, { props: { visible: true, platform: null } }))
    await nextTick()

    expect(document.body.textContent).toContain('Add Payment Platform')
    expect((wrapper.vm as unknown as { form: DialogForm }).form.company).toBe('')
  })

  it('opens in edit mode with the platform it was given', async () => {
    const wrapper = await track(await mountSuspended(PlatformDialog, {
      props: { visible: true, platform: makePlatform({ company: 'Wise', feePercent: 0, feeFlat: 15 }) },
    }))
    await nextTick()

    expect(document.body.textContent).toContain('Edit Wise')
    expect((wrapper.vm as unknown as { form: DialogForm }).form.company).toBe('Wise')
    expect((wrapper.vm as unknown as { form: DialogForm }).form.feeFlat).toBe(15)
  })

  it('refuses to save without a company name', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(PlatformDialog, { props: { visible: true, platform: null } }))
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(document.body.textContent).toContain('Company name is required.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('refuses a company name over 120 characters', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(PlatformDialog, { props: { visible: true, platform: null } }))
    await nextTick()

    ;(wrapper.vm as unknown as { form: DialogForm }).form.company = 'x'.repeat(121)
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(document.body.textContent).toContain('Keep the name under 120 characters.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('refuses a percentage fee above 100', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(PlatformDialog, { props: { visible: true, platform: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.company = 'Payoneer'
    vm.form.feePercent = 101
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(document.body.textContent).toContain('Percentage fee cannot exceed 100%.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('refuses a negative percentage fee', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(PlatformDialog, { props: { visible: true, platform: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.company = 'Payoneer'
    vm.form.feePercent = -1
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(document.body.textContent).toContain('Fee cannot be negative.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('refuses a negative flat fee', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(PlatformDialog, { props: { visible: true, platform: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.company = 'Wise'
    vm.form.feeFlat = -0.5
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(document.body.textContent).toContain('Flat fee cannot be negative.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('creates a platform and closes the dialog', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue({ success: true, data: makePlatform({ company: 'Payoneer' }) })
    const wrapper = await track(await mountSuspended(PlatformDialog, { props: { visible: true, platform: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.company = '  Payoneer  '
    vm.form.feePercent = 1
    vm.form.feeFlat = 0
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(mock).toHaveBeenCalledWith(
      '/api/payment-platforms',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ company: 'Payoneer', feePercent: 1, feeFlat: 0 }),
      }),
    )
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('updates the platform it was opened with', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue({ success: true, data: makePlatform({ company: 'Payoneer EU' }) })
    const wrapper = await track(await mountSuspended(PlatformDialog, {
      props: { visible: true, platform: makePlatform() },
    }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.company = 'Payoneer EU'
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(mock).toHaveBeenCalledWith(
      '/api/payment-platforms/1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('shows the backend validation errors inline', async () => {
    const mock = await fetchMock()
    const { ApiError } = await import('~/composables/useApi')
    mock.mockRejectedValue(new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'A platform with this company already exists.',
      details: [{ path: 'company', message: 'A platform with this company already exists.' }],
    }, 400))
    const wrapper = await track(await mountSuspended(PlatformDialog, { props: { visible: true, platform: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.company = 'Payoneer'
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(document.body.textContent).toContain('Could not save')
    expect(document.body.textContent).toContain('A platform with this company already exists.')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})
