// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientSummary, Project } from '~/types/api'
import { ApiError } from '~/composables/useApi'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const acme: ClientSummary = {
  id: 1,
  name: 'Acme Corp',
  contactEmail: 'billing@acme.example',
  ccEmail: null,
  billingHour: 130,
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
    client: acme,
    createdAt: '2026-10-22T18:04:10.402Z',
    updatedAt: '2026-10-22T18:04:10.402Z',
    ...overrides,
  }
}

const ok = <T>(data: T) => ({ success: true, data })

describe('useProjects', () => {
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

  it('sends only the archived filter by default (contract §3.4 default "false")', async () => {
    fetchMock.mockResolvedValue(ok([]))
    const { refresh } = useProjects()

    await refresh({ force: true })

    expect(fetchMock).toHaveBeenCalledWith(
      `${base}/projects`,
      expect.objectContaining({ query: { archived: 'false' } }),
    )
  })

  it('maps the standalone scope to ?standalone=true', async () => {
    fetchMock.mockResolvedValue(ok([]))
    const { setQuery, query } = useProjects()

    await setQuery({ scope: 'standalone', clientId: null, archived: false })

    expect(query.value.scope).toBe('standalone')
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${base}/projects`,
      expect.objectContaining({ query: { standalone: 'true', archived: 'false' } }),
    )
  })

  it('maps a chosen client to ?clientId=<id> and drops the standalone flag', async () => {
    fetchMock.mockResolvedValue(ok([]))
    const { setQuery } = useProjects()

    await setQuery({ scope: 'client', clientId: 7, archived: 'all' })

    expect(fetchMock).toHaveBeenLastCalledWith(
      `${base}/projects`,
      expect.objectContaining({ query: { clientId: '7' } }),
    )
  })

  it('keeps the list sorted by name after a create', async () => {
    fetchMock.mockResolvedValue(ok([makeProject({ id: 2, name: 'Zeta Rebuild' })]))
    const { projects, refresh, create } = useProjects()
    await refresh({ force: true })

    fetchMock.mockResolvedValue(ok(makeProject({ id: 1, name: 'API Microservice' })))
    await create({ name: 'API Microservice', clientId: 1 })

    expect(projects.value.map(p => p.name)).toEqual(['API Microservice', 'Zeta Rebuild'])
  })

  it('sends clientId: null for a standalone project', async () => {
    fetchMock.mockResolvedValue(ok(makeProject({
      id: 4,
      name: 'Internal Tools',
      clientId: null,
      client: null,
      standalone: true,
      billingHour: 95,
      effectiveRate: 95,
      rateSource: 'project',
    })))
    const { create } = useProjects()

    await create({ name: 'Internal Tools', clientId: null, billingHour: 95 })

    const [, options] = fetchMock.mock.calls.at(-1)!
    expect(options.body).toMatchObject({ name: 'Internal Tools', clientId: null, billingHour: 95 })
  })

  it('surfaces the backend 400 for a standalone project with no rate', async () => {
    const { create } = useProjects()
    fetchMock.mockRejectedValue(new ApiError(
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid payload',
        details: [{ path: 'billingHour', message: 'Standalone projects require billingHour' }],
      },
      400,
    ))

    await expect(create({ name: 'Internal Tools', clientId: null })).rejects.toBeInstanceOf(ApiError)

    try {
      await create({ name: 'Internal Tools', clientId: null })
    }
    catch (error) {
      expect((error as ApiError).fieldErrors).toEqual({ billingHour: 'Standalone projects require billingHour' })
    }
  })

  it('counts linked, standalone and override projects for the stat tiles', async () => {
    fetchMock.mockResolvedValue(ok([
      makeProject({ id: 1, name: 'Inherited' }),
      makeProject({ id: 2, name: 'Overridden', billingHour: 115, effectiveRate: 115, rateSource: 'project' }),
      makeProject({
        id: 3,
        name: 'Standalone',
        clientId: null,
        client: null,
        standalone: true,
        billingHour: 95,
        effectiveRate: 95,
        rateSource: 'project',
      }),
      makeProject({ id: 4, name: 'Archived', archived: true }),
    ]))
    const { linkedCount, standaloneCount, overrideCount, refresh } = useProjects()
    await refresh({ force: true })

    expect(linkedCount.value).toBe(2)
    expect(standaloneCount.value).toBe(1)
    // Overrides are only meaningful for client-attached projects.
    expect(overrideCount.value).toBe(1)
  })

  it('filters the drawer project list by client', async () => {
    fetchMock.mockResolvedValue(ok([
      makeProject({ id: 1, name: 'Acme A', clientId: 1 }),
      makeProject({ id: 2, name: 'Acme B', clientId: 1 }),
      makeProject({
        id: 3,
        name: 'Loose',
        clientId: null,
        client: null,
        standalone: true,
        billingHour: 95,
        effectiveRate: 95,
        rateSource: 'project',
      }),
      makeProject({ id: 4, name: 'Archived', archived: true }),
    ]))
    const { forClient, refresh } = useProjects()
    await refresh({ force: true })

    expect(forClient(1).map(p => p.name)).toEqual(['Acme A', 'Acme B'])
    expect(forClient(null).map(p => p.name)).toEqual(['Loose'])
  })

  it('removes a project and blocks a referenced delete with 409', async () => {
    fetchMock.mockResolvedValue(ok([makeProject({ id: 1 }), makeProject({ id: 2, name: 'Other' })]))
    const { projects, refresh, remove } = useProjects()
    await refresh({ force: true })

    fetchMock.mockRejectedValue(new ApiError(
      { code: 'CONFLICT', message: 'Project is referenced by work records' },
      409,
    ))
    await expect(remove(1)).rejects.toBeInstanceOf(ApiError)
    expect(projects.value).toHaveLength(2)

    fetchMock.mockResolvedValue(ok({ id: 1, deleted: true }))
    await remove(1)
    expect(projects.value.map(p => p.id)).toEqual([2])
  })
})