// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientSummary, Project, WorkRecord } from '~/types/api'
import RecordDrawer from '~/components/timesheet/RecordDrawer.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const acme: ClientSummary = {
  id: 1,
  name: 'Acme Corp',
  contactEmail: 'billing@acme.example',
  ccEmail: null,
  billingHour: 130,
}

/** The project of the record below — a client project that inherits the rate. */
const storefront: Project = {
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
}

const record: WorkRecord = {
  id: 1,
  weekId: 1,
  projectId: 1,
  project: { id: 1, name: 'E-Commerce Storefront', clientId: 1 },
  clientId: 1,
  client: acme,
  description: 'Checkout flow rebuild',
  hours: 3.5,
  date: '2026-10-19',
  rate: 130,
  lineTotal: 455,
  createdAt: '2026-10-22T18:04:11.120Z',
  updatedAt: '2026-10-22T18:04:11.120Z',
}

const props = {
  visible: true,
  weekId: 1,
  startDate: '2026-10-19',
  endDate: '2026-10-25',
  record,
  requestedDate: '2026-10-19',
  readOnly: false,
  currencySymbol: '$',
}

function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

/**
 * GAP-004 regression.
 *
 * The drawer used to drop the record's project: the form was filled before the
 * project list had loaded, so the `form.clientId` watcher saw an empty list,
 * concluded the project was invalid and nulled `projectId` — and never re-ran
 * once the projects arrived. The drawer then showed "Pick a project for this
 * entry." and a $0.00 estimated total, and Save was blocked.
 */
describe('GAP-004 — editing a record keeps its project', () => {
  beforeEach(() => {
    clearNuxtState()
    document.body.innerHTML = ''
  })

  it('keeps the project and shows a non-zero total once the projects load', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    // Hold the project list back so we can observe the window in which it is
    // still empty — the exact moment the old code dropped the selection.
    let releaseProjects: (value: unknown) => void = () => {}
    const projectsPending = new Promise((resolve) => {
      releaseProjects = resolve
    })

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith('/projects')) {
        return projectsPending as never
      }
      if (String(url).endsWith('/clients')) {
        return Promise.resolve({ success: true, data: [acme] }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })

    const wrapper = await mountSuspended(RecordDrawer, { props })
    await nextTick()
    await nextTick()

    const state = (wrapper.vm as unknown as {
      form: { projectId: number | null }
    }).form

    // The list is still empty here. The selection must survive it.
    expect(state.projectId).toBe(1)

    releaseProjects({ success: true, data: [storefront] })
    await nextTick()
    await nextTick()
    await nextTick()

    // The project select must still carry the record's project.
    const select = q('[data-testid="record-project-select"]')
    expect(select).not.toBeNull()

    // The rate badge shows the project's rate, not a blank.
    const badge = q('[data-testid="rate-badge"]')
    expect(badge?.textContent).toContain('130.00')

    // The estimated total is non-zero (3.5 h × $130.00).
    const total = q('[data-testid="estimated-total"]')
    expect(total).not.toBeNull()
    expect(total?.textContent).toContain('455.00')

    // No "pick a project" validation error is shown.
    expect(document.body.textContent).not.toContain('Pick a project for this entry')

    wrapper.unmount()
  })

  it('still clears an incompatible project when the client is changed by hand', async () => {
    const { $fetch } = await import('#build/fetch')
    const fetchMock = vi.mocked($fetch)

    const starlightProject: Project = {
      ...storefront,
      id: 2,
      name: 'Video Streaming Mobile App',
      clientId: 2,
      billingHour: 115,
      effectiveRate: 115,
      rateSource: 'project',
      client: { ...acme, id: 2, name: 'Starlight Media', billingHour: 100 },
    }

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith('/projects')) {
        return Promise.resolve({ success: true, data: [storefront, starlightProject] }) as never
      }
      if (String(url).endsWith('/clients')) {
        return Promise.resolve({
          success: true,
          data: [acme, { ...acme, id: 2, name: 'Starlight Media', billingHour: 100 }],
        }) as never
      }
      return Promise.resolve({ success: true, data: [] }) as never
    })

    const wrapper = await mountSuspended(RecordDrawer, { props })
    await nextTick()
    await nextTick()
    await nextTick()

    // The record's project is loaded and selected.
    expect(q('[data-testid="rate-badge"]')?.textContent).toContain('130.00')

    // Switch to a client that does not own the selected project — the same
    // path the Select takes when the user picks a different client.
    const state = (wrapper.vm as unknown as {
      form: { clientId: number, projectId: number | null }
    }).form
    expect(state).toBeTruthy()
    expect(state.projectId).toBe(1)

    state.clientId = 2
    await nextTick()
    await nextTick()

    // The project no longer belongs to the new client, so it must be cleared.
    expect(state.projectId).toBeNull()

    wrapper.unmount()
  })
})
