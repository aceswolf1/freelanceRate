import type { Project, ProjectInput, ProjectUpdate } from '../types/api'
import { ApiError } from './useApi'

/** Query state for the projects filter strip (contract §3.4). */
export type ProjectScope = 'all' | 'client' | 'standalone'

export interface ProjectQuery {
  scope: ProjectScope
  clientId: number | null
  archived: boolean | 'all'
}

/**
 * Projects (R2) — `GET /api/projects?clientId|standalone|archived`,
 * `POST /api/projects`, `PATCH/DELETE /api/projects/:id`.
 *
 * Filtering is server-side so the list stays authoritative; `allProjects` is a
 * second cache used by the timesheet drawer (which needs every active project).
 */
export function useProjectsState() {
  const state = useState<Project[]>('bf:projects', () => [])
  // `clearNuxtState()` can leave `.value` undefined; consumers must never have
  // to guard every `.map` / `.filter` against that.
  return computed({
    get: () => state.value ?? [],
    set: (value: Project[]) => {
      state.value = value
    },
  })
}

export function useProjects() {
  const projects = useProjectsState()
  const pending = useState<boolean>('bf:projects:pending', () => false)
  const loaded = useState<boolean>('bf:projects:loaded', () => false)
  const query = useState<ProjectQuery>('bf:projects:query', () => ({
    scope: 'all',
    clientId: null,
    archived: false,
  }))
  const notifier = useNotifier()

  // Resolved once, here in setup: `useApi()` reads `useRuntimeConfig()`, which needs an
  // active Nuxt instance. Resolving it lazily inside an async function can run
  // after the context is gone (SSR) and throw.
  const api = useApi()

  /** Mirrors the filter into the contract's query params (contract §3.4). */
  function buildQueryParams(current: ProjectQuery): Record<string, string> {
    const params: Record<string, string> = {}

    if (current.clientId !== null) {
      params.clientId = String(current.clientId)
    }
    else if (current.scope === 'standalone') {
      params.standalone = 'true'
    }

    if (current.archived !== 'all') {
      params.archived = String(current.archived)
    }

    return params
  }

  async function refresh(options: { silent?: boolean, force?: boolean } = {}): Promise<Project[]> {
    if (pending.value || (loaded.value && !options.force)) {
      return projects.value
    }

    pending.value = true
    try {
      projects.value = await api.get<Project[]>('/projects', {
        query: buildQueryParams(query.value),
        silent: options.silent ?? false,
      })
      loaded.value = true
    }
    catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'NOT_FOUND') {
        throw error
      }
      projects.value = []
    }
    finally {
      pending.value = false
    }

    return projects.value
  }

  async function setQuery(next: ProjectQuery): Promise<Project[]> {
    query.value = next
    return refresh({ force: true })
  }

  async function create(input: ProjectInput): Promise<Project> {
    const created = await api.post<Project>('/projects', input, { silent: true })
    projects.value = sortByName([...projects.value, created])
    return created
  }

  async function update(id: number, patch: ProjectUpdate): Promise<Project> {
    const updated = await api.patch<Project>(`/projects/${id}`, patch, { silent: true })
    projects.value = sortByName(
      projects.value.map(project => (project.id === id ? updated : project)),
    )
    return updated
  }

  async function remove(id: number): Promise<void> {
    await api.del(`/projects/${id}`, { silent: true })
    projects.value = projects.value.filter(project => project.id !== id)
  }

  const byId = (id: number | null): Project | undefined =>
    id === null ? undefined : projects.value.find(project => project.id === id)

  /** Active (non-archived) projects attached to one client — feeds the drawer select. */
  function forClient(clientId: number | null): Project[] {
    return projects.value
      .filter(project => !project.archived)
      .filter(project => (clientId === null ? project.standalone : project.clientId === clientId))
  }

  const standaloneCount = computed(() => projects.value.filter(p => p.standalone && !p.archived).length)
  const linkedCount = computed(() => projects.value.filter(p => !p.standalone && !p.archived).length)
  const overrideCount = computed(
    () => projects.value.filter(p => p.rateSource === 'project' && !p.standalone && !p.archived).length,
  )

  return {
    projects,
    pending,
    loaded,
    query,
    standaloneCount,
    linkedCount,
    overrideCount,
    refresh,
    setQuery,
    create,
    update,
    remove,
    byId,
    forClient,
    notifyError: (message: string) => notifier.error('Could not save', message),
  }
}

const byName = (a: Project, b: Project): number => a.name.localeCompare(b.name)
const sortByName = (list: Project[]): Project[] => [...list].sort(byName)