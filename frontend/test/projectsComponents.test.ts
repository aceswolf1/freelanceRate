// @vitest-environment nuxt
/**
 * Behaviour tests for the projects UI:
 * `app/components/projects/ProjectsTable.vue` and
 * `app/components/projects/ProjectDialog.vue`.
 *
 * Scenarios covered:
 * - the directory shows the client association, the scope and — most
 *   importantly — whether the rate is inherited from the client or an override;
 * - a standalone project says so instead of naming a client;
 * - the row actions emit `edit` and `remove`;
 * - the create/edit dialog validates the name, the rate and the description;
 * - a standalone project must set its own rate (contract §3.4);
 * - saving posts the project, emits `saved` and closes the dialog;
 * - a backend validation error is shown inline, field by field.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { clearNuxtState } from '#app'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Client, Project } from '~/types/api'
import ProjectDialog from '~/components/projects/ProjectDialog.vue'
import ProjectsTable from '~/components/projects/ProjectsTable.vue'
import { useClientsState } from '~/composables/useClients'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

const acme: Client = {
  id: 1,
  name: 'Acme Corp',
  contactName: null,
  contactEmail: 'billing@acme.example',
  ccEmail: null,
  billingHour: 130,
  paymentPlatformId: null,
  paymentPlatform: null,
  projectCount: 1,
  totalHours: 12,
  totalGross: 1560,
  notes: null,
  createdAt: '2026-10-22T18:04:10.402Z',
  updatedAt: '2026-10-22T18:04:10.402Z',
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'E-Commerce Storefront',
    clientId: 1,
    description: 'Next.js storefront',
    billingHour: null,
    effectiveRate: 130,
    rateSource: 'client',
    standalone: false,
    archived: false,
    client: { id: 1, name: 'Acme Corp', contactEmail: 'billing@acme.example', ccEmail: null, billingHour: 130 },
    createdAt: '2026-10-22T18:04:10.402Z',
    updatedAt: '2026-10-22T18:04:10.402Z',
    ...overrides,
  }
}

/** The dialog's form state — the same reactive object the inputs are bound to. */
type DialogForm = {
  name: string
  clientId: number
  description: string
  billingHour: number | null
  archived: boolean
}

/** Every wrapper is unmounted after its test, before the DOM is wiped. */
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

describe('ProjectsTable', () => {
  it('renders a row per project with its display id', async () => {
    const wrapper = await mountSuspended(ProjectsTable, {
      props: { projects: [makeProject()], loading: false },
    })

    expect(wrapper.find('[data-testid="project-id-1"]').text()).toBe('#PRJ-001')
    expect(wrapper.text()).toContain('E-Commerce Storefront')
  })

  it('names the client a project belongs to', async () => {
    const wrapper = await mountSuspended(ProjectsTable, {
      props: { projects: [makeProject()], loading: false },
    })

    expect(wrapper.find('[data-testid="project-client-1"]').text()).toContain('Acme Corp')
  })

  it('marks a standalone project instead of naming a client', async () => {
    const wrapper = await mountSuspended(ProjectsTable, {
      props: {
        projects: [makeProject({ id: 2, clientId: null, standalone: true, client: null, effectiveRate: 90, rateSource: 'project' })],
        loading: false,
      },
    })

    expect(wrapper.find('[data-testid="project-standalone"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Standalone project rate')
  })

  it('says the rate is inherited from the client', async () => {
    const wrapper = await mountSuspended(ProjectsTable, {
      props: { projects: [makeProject()], loading: false },
    })

    expect(wrapper.text()).toContain('Inherited from Acme Corp')
    expect(wrapper.find('[data-testid="project-override-badge"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('$130.00')
  })

  it('flags a project rate override and shows the client standard', async () => {
    const wrapper = await mountSuspended(ProjectsTable, {
      props: { projects: [makeProject({ billingHour: 150, effectiveRate: 150, rateSource: 'project' })], loading: false },
    })

    const badge = wrapper.find('[data-testid="project-override-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('$130.00')
    expect(wrapper.text()).toContain('$150.00')
  })

  it('shows the description, or a dash when there is none', async () => {
    const withDescription = await mountSuspended(ProjectsTable, {
      props: { projects: [makeProject()], loading: false },
    })
    expect(withDescription.text()).toContain('Next.js storefront')

    const without = await mountSuspended(ProjectsTable, {
      props: { projects: [makeProject({ description: null })], loading: false },
    })
    expect(without.text()).toContain('—')
  })

  it('marks an archived project', async () => {
    const wrapper = await mountSuspended(ProjectsTable, {
      props: { projects: [makeProject({ archived: true })], loading: false },
    })

    expect(wrapper.text()).toContain('Archived')
  })

  it('emits edit and remove with the project they belong to', async () => {
    const wrapper = await mountSuspended(ProjectsTable, {
      props: { projects: [makeProject()], loading: false },
    })

    await wrapper.find('[data-testid="edit-project-1"]').trigger('click')
    await wrapper.find('[data-testid="delete-project-1"]').trigger('click')

    expect((wrapper.emitted('edit')![0]![0] as Project).name).toBe('E-Commerce Storefront')
    expect((wrapper.emitted('remove')![0]![0] as Project).id).toBe(1)
  })

  it('shows the empty state when there are no projects', async () => {
    const wrapper = await mountSuspended(ProjectsTable, {
      props: { projects: [], loading: false },
    })

    expect(wrapper.text()).toContain('No projects yet')
  })
})

describe('ProjectDialog', () => {
  beforeEach(async () => {
    clearNuxtState()
    await fetchMock()
    useClientsState().value = [acme]
  })

  afterEach(() => {
    for (const wrapper of mounted.splice(0)) {
      wrapper.unmount()
    }
    document.body.innerHTML = ''
  })

  it('opens in create mode', async () => {
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    expect(document.body.textContent).toContain('Create New Project')
  })

  it('opens in edit mode with the project name in the heading', async () => {
    const wrapper = await track(await mountSuspended(ProjectDialog, {
      props: { visible: true, project: makeProject() },
    }))
    await nextTick()

    expect(document.body.textContent).toContain('Edit E-Commerce Storefront')
  })

  it('refuses to save without a name', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await nextTick()
    await nextTick()

    expect(document.body.textContent).toContain('Project name is required.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('refuses a standalone project that has no rate of its own', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.name = 'Internal Tools'
    vm.form.clientId = -1
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await nextTick()
    await nextTick()

    expect(document.body.textContent).toContain('Standalone projects must set their own billing hour.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('refuses a rate that is not greater than zero', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.name = 'Internal Tools'
    vm.form.clientId = -1
    vm.form.billingHour = 0
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await nextTick()
    await nextTick()

    expect(document.body.textContent).toContain('Rate must be greater than 0.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('refuses a rate above the 10,000 ceiling', async () => {
    const mock = await fetchMock()
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.name = 'Internal Tools'
    vm.form.clientId = -1
    vm.form.billingHour = 10_001
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await nextTick()
    await nextTick()

    expect(document.body.textContent).toContain('Rate must be 10,000 or less.')
    expect(mock).not.toHaveBeenCalled()
  })

  it('creates a standalone project with its own rate', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue({
      success: true,
      data: makeProject({ id: 9, name: 'Internal Tools', clientId: null, standalone: true, billingHour: 90, effectiveRate: 90, rateSource: 'project', client: null }),
    })
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.name = '  Internal Tools  '
    vm.form.clientId = -1
    vm.form.billingHour = 90
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(mock).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ name: 'Internal Tools', clientId: null, billingHour: 90 }),
      }),
    )
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('creates a client project that inherits the client rate', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue({ success: true, data: makeProject() })
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.name = 'E-Commerce Storefront'
    vm.form.clientId = 1
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(mock).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ clientId: 1, billingHour: null }),
      }),
    )
  })

  it('updates the project it was opened with', async () => {
    const mock = await fetchMock()
    mock.mockResolvedValue({ success: true, data: makeProject({ name: 'Storefront v2' }) })
    const wrapper = await track(await mountSuspended(ProjectDialog, {
      props: { visible: true, project: makeProject() },
    }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.name = 'Storefront v2'
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(mock).toHaveBeenCalledWith(
      '/api/projects/1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('shows the backend validation errors inline', async () => {
    const mock = await fetchMock()
    const { ApiError } = await import('~/composables/useApi')
    mock.mockRejectedValue(new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Project name is already taken.',
      details: [{ path: 'name', message: 'Project name is already taken.' }],
    }, 400))
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.name = 'Storefront'
    vm.form.clientId = 1
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    expect(document.body.textContent).toContain('Could not save')
    expect(document.body.textContent).toContain('Project name is already taken.')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('shows the failure message when the API is unreachable', async () => {
    const mock = await fetchMock()
    mock.mockRejectedValue(new Error('socket hang up'))
    const wrapper = await track(await mountSuspended(ProjectDialog, { props: { visible: true, project: null } }))
    await nextTick()

    const vm = wrapper.vm as unknown as { form: DialogForm }
    vm.form.name = 'Storefront'
    vm.form.clientId = 1
    await nextTick()

    q<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()
    await nextTick()

    // `useApi` wraps every transport failure in an `ApiError`, so the dialog
    // shows the underlying message under the "Could not save" heading.
    expect(document.body.textContent).toContain('Could not save')
    expect(document.body.textContent).toContain('socket hang up')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})
