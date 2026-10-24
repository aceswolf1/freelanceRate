// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Client } from '~/types/api'
import { ApiError } from '~/composables/useApi'

// Nuxt resolves the `$fetch` auto-import to the `#build/fetch` virtual module
// (see .nuxt/imports.d.ts), so that — not `ofetch` or the global — is what has
// to be mocked to intercept API calls.
vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

/** Minimal contract-accurate client (contract §3.3). */
function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    name: 'Acme Corp',
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
    ...overrides,
  }
}

const ok = <T>(data: T) => ({ success: true, data })

describe('useClients', () => {
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

  it('loads the list from GET /clients', async () => {
    fetchMock.mockResolvedValue(ok([makeClient()]))
    const { clients, refresh: load, loaded } = useClients()

    await load({ force: true })

    expect(fetchMock).toHaveBeenCalledWith(
      `${base}/clients`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(clients.value).toHaveLength(1)
    expect(loaded.value).toBe(true)
  })

  it('treats 404 as an empty list instead of an error', async () => {
    fetchMock.mockRejectedValue(new ApiError({ code: 'NOT_FOUND', message: 'Route not found' }, 404))
    const { clients, refresh: load } = useClients()

    await expect(load({ force: true, silent: true })).resolves.toEqual([])
    expect(clients.value).toEqual([])
  })

  it('adds a created client and keeps the list sorted by name', async () => {
    fetchMock.mockResolvedValue(ok([makeClient({ id: 2, name: 'Zeta Labs' })]))
    const { clients, refresh: load, create } = useClients()
    await load({ force: true })

    fetchMock.mockResolvedValue(ok(makeClient({ id: 1, name: 'Acme Corp' })))
    await create({
      name: 'Acme Corp',
      contactEmail: 'billing@acme.example',
      billingHour: 130,
    })

    expect(clients.value.map(c => c.name)).toEqual(['Acme Corp', 'Zeta Labs'])
  })

  it('replaces the edited client in place', async () => {
    fetchMock.mockResolvedValue(ok([makeClient({ id: 1, name: 'Acme Corp' }), makeClient({ id: 2, name: 'Beta' })]))
    const { clients, refresh: load, update } = useClients()
    await load({ force: true })

    fetchMock.mockResolvedValue(ok(makeClient({ id: 1, name: 'Acme Corp', billingHour: 145 })))
    await update(1, { billingHour: 145 })

    expect(clients.value.find(c => c.id === 1)?.billingHour).toBe(145)
    expect(clients.value).toHaveLength(2)
  })

  it('drops a deleted client', async () => {
    fetchMock.mockResolvedValue(ok([makeClient({ id: 1 }), makeClient({ id: 2, name: 'Beta' })]))
    const { clients, refresh: load, remove } = useClients()
    await load({ force: true })

    fetchMock.mockResolvedValue(ok({ id: 1, deleted: true }))
    await remove(1)

    expect(clients.value.map(c => c.id)).toEqual([2])
  })

  it('surfaces a 409 on delete instead of mutating the list', async () => {
    fetchMock.mockResolvedValue(ok([makeClient({ id: 1 })]))
    const { clients, refresh: load, remove } = useClients()
    await load({ force: true })

    fetchMock.mockRejectedValue(new ApiError(
      { code: 'CONFLICT', message: 'Client is referenced by work records' },
      409,
    ))

    await expect(remove(1)).rejects.toBeInstanceOf(ApiError)
    expect(clients.value).toHaveLength(1)
  })

  it('derives select options and totals for the UI', async () => {
    fetchMock.mockResolvedValue(ok([
      makeClient({ id: 1, name: 'Acme Corp', billingHour: 130, totalHours: 10, totalGross: 1300 }),
      makeClient({ id: 2, name: 'Beta', billingHour: 100, totalHours: 5, totalGross: 500 }),
    ]))
    const { options, totalUnbilledHours, totalUnbilledGross, refresh: load } = useClients()
    await load({ force: true })

    expect(options.value.map(o => o.displayId)).toEqual(['#CLI-001', '#CLI-002'])
    expect(totalUnbilledHours.value).toBe(15)
    expect(totalUnbilledGross.value).toBe(1800)
  })
})