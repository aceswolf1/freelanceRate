// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PaymentPlatform, Settings } from '~/types/api'
import { ApiError } from '~/composables/useApi'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const settingsRow: Settings = {
  id: 1,
  displayName: 'Alex Morgan',
  weeklyTargetHours: 40,
  currencySymbol: '$',
  invoicePrefix: 'INV',
  updatedAt: '2026-10-22T18:04:11.001Z',
}

function makePlatform(overrides: Partial<PaymentPlatform> = {}): PaymentPlatform {
  return {
    id: 1,
    company: 'Payoneer',
    feePercent: 1,
    feeFlat: 0,
    createdAt: '2026-10-22T18:04:11.204Z',
    ...overrides,
  }
}

const ok = <T>(data: T) => ({ success: true, data })

describe('useSettings', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  /** Derived from runtimeConfig so the assertions survive a port change. */
  let base: string

  beforeEach(async () => {
    clearNuxtState()
    base = useRuntimeConfig().public.apiBase as string
    const { $fetch } = await import('#build/fetch')
    fetchMock = vi.mocked($fetch)
    fetchMock.mockReset()
  })

  it('starts from the documented defaults so the shell renders with the API down', () => {
    const { settings, currencySymbol, weeklyTargetHours, invoicePrefix } = useSettings()

    expect(settings.value).toMatchObject({ displayName: 'Consultant', weeklyTargetHours: 40, currencySymbol: '$' })
    expect(currencySymbol.value).toBe('$')
    expect(weeklyTargetHours.value).toBe(40)
    expect(invoicePrefix.value).toBe('INV')
  })

  it('loads the singleton row', async () => {
    fetchMock.mockResolvedValue(ok(settingsRow))
    const { load, displayName } = useSettings()

    await load({ force: true })

    expect(fetchMock).toHaveBeenCalledWith(
      `${base}/settings`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(displayName.value).toBe('Alex Morgan')
  })

  it('keeps the defaults when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new ApiError({ code: 'NETWORK_ERROR', message: 'fetch failed' }))
    const { load, currencySymbol } = useSettings()

    await expect(load({ force: true })).resolves.toBeTruthy()
    expect(currencySymbol.value).toBe('$')
  })

  it('saves a partial update with PUT and adopts the returned row', async () => {
    fetchMock.mockResolvedValue(ok({ ...settingsRow, currencySymbol: '€', weeklyTargetHours: 35 }))
    const { save, currencySymbol, weeklyTargetHours } = useSettings()

    await save({ currencySymbol: '€', weeklyTargetHours: 35 })

    const [, options] = fetchMock.mock.calls.at(-1)!
    expect(options.method).toBe('PUT')
    expect(options.body).toEqual({ currencySymbol: '€', weeklyTargetHours: 35 })
    expect(currencySymbol.value).toBe('€')
    expect(weeklyTargetHours.value).toBe(35)
  })
})

describe('usePaymentPlatforms', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  /** Derived from runtimeConfig so the assertions survive a port change. */
  let base: string

  beforeEach(async () => {
    clearNuxtState()
    base = useRuntimeConfig().public.apiBase as string
    const { $fetch } = await import('#build/fetch')
    fetchMock = vi.mocked($fetch)
    fetchMock.mockReset()
  })

  it('loads rails ordered as the API returns them', async () => {
    fetchMock.mockResolvedValue(ok([
      makePlatform({ id: 1, company: 'Payoneer', feePercent: 1, feeFlat: 0 }),
      makePlatform({ id: 2, company: 'Domestic Wire', feePercent: 0, feeFlat: 15 }),
    ]))
    const { platforms, refresh } = usePaymentPlatforms()

    await refresh({ force: true })

    expect(platforms.value.map(p => p.company)).toEqual(['Payoneer', 'Domestic Wire'])
  })

  it('offers a "no platform" option so the clients dialog can clear the rail', async () => {
    fetchMock.mockResolvedValue(ok([makePlatform()]))
    const { options, refresh } = usePaymentPlatforms()
    await refresh({ force: true })

    expect(options.value[0]).toEqual({ id: null, company: 'No payment platform' })
  })

  it('sorts a created rail by company', async () => {
    fetchMock.mockResolvedValue(ok([makePlatform({ id: 2, company: 'Wise Transfer' })]))
    const { platforms, refresh, create } = usePaymentPlatforms()
    await refresh({ force: true })

    fetchMock.mockResolvedValue(ok(makePlatform({ id: 1, company: 'Domestic Wire' })))
    await create({ company: 'Domestic Wire', feePercent: 0, feeFlat: 15 })

    expect(platforms.value.map(p => p.company)).toEqual(['Domestic Wire', 'Wise Transfer'])
  })

  it('surfaces the 409 raised by a duplicate company', async () => {
    const { create } = usePaymentPlatforms()
    fetchMock.mockRejectedValue(new ApiError(
      { code: 'CONFLICT', message: 'Payment platform "Payoneer" already exists' },
      409,
    ))

    await expect(create({ company: 'Payoneer' })).rejects.toBeInstanceOf(ApiError)
  })

  it('removes a rail and drops it from the option list', async () => {
    fetchMock.mockResolvedValue(ok([
      makePlatform({ id: 1, company: 'Payoneer' }),
      makePlatform({ id: 2, company: 'Wise Transfer' }),
    ]))
    const { platforms, refresh, remove } = usePaymentPlatforms()
    await refresh({ force: true })

    fetchMock.mockResolvedValue(ok({ id: 1, deleted: true }))
    await remove(1)

    expect(platforms.value.map(p => p.id)).toEqual([2])
  })
})