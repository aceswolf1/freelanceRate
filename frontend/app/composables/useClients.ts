import type { Client, ClientInput, ClientUpdate } from '../types/api'
import { ApiError } from './useApi'

/**
 * Clients (R1) — `GET/POST /api/clients`, `PATCH/DELETE /api/clients/:id`.
 *
 * The list is a single `useState` singleton so the clients table, the projects
 * client-filter and the timesheet drawer all share one fetch.
 */
export function useClientsState() {
  const state = useState<Client[]>('bf:clients', () => [])
  // `clearNuxtState()` can leave `.value` undefined; consumers must never have
  // to guard every `.map` / `.filter` against that.
  return computed({
    get: () => state.value ?? [],
    set: (value: Client[]) => {
      state.value = value
    },
  })
}

export function useClients() {
  const clients = useClientsState()
  const pending = useState<boolean>('bf:clients:pending', () => false)
  const loaded = useState<boolean>('bf:clients:loaded', () => false)
  const notifier = useNotifier()

  // Resolved once, here in setup: `useApi()` reads `useRuntimeConfig()`, which needs an
  // active Nuxt instance. Resolving it lazily inside an async function can run
  // after the context is gone (SSR) and throw.
  const api = useApi()

  async function refresh(options: { silent?: boolean, force?: boolean } = {}): Promise<Client[]> {
    if (pending.value || (loaded.value && !options.force)) {
      return clients.value
    }

    pending.value = true
    try {
      clients.value = await api.get<Client[]>('/clients', { silent: options.silent ?? false })
      loaded.value = true
    }
    catch (error) {
      // 404 simply means the module is not mounted yet — leave the list empty
      // rather than flashing an error while worker-1 is still building it.
      if (!(error instanceof ApiError) || error.code !== 'NOT_FOUND') {
        throw error
      }
      clients.value = []
    }
    finally {
      pending.value = false
    }

    return clients.value
  }

  async function create(input: ClientInput): Promise<Client> {
    const created = await api.post<Client>('/clients', input, { silent: true })
    clients.value = [...clients.value, created].sort(byName)
    return created
  }

  async function update(id: number, patch: ClientUpdate): Promise<Client> {
    const updated = await api.patch<Client>(`/clients/${id}`, patch, { silent: true })
    clients.value = sortByName(clients.value.map(client => (client.id === id ? updated : client)))
    return updated
  }

  async function remove(id: number): Promise<void> {
    await api.del(`/clients/${id}`, { silent: true })
    clients.value = clients.value.filter(client => client.id !== id)
  }

  const byId = (id: number | null): Client | undefined =>
    id === null ? undefined : clients.value.find(client => client.id === id)

  /** Options for a `<Select>` of clients, sorted the same way the table is. */
  const options = computed(() =>
    clients.value.map(client => ({
      id: client.id,
      name: client.name,
      displayId: `#CLI-${String(client.id).padStart(3, '0')}`,
      rate: client.billingHour,
    })),
  )

  const totalUnbilledGross = computed(() =>
    clients.value.reduce((sum, client) => sum + (client.totalGross ?? 0), 0),
  )

  const totalUnbilledHours = computed(() =>
    clients.value.reduce((sum, client) => sum + (client.totalHours ?? 0), 0),
  )

  return {
    clients,
    pending,
    loaded,
    options,
    totalUnbilledGross,
    totalUnbilledHours,
    refresh,
    create,
    update,
    remove,
    byId,
    notifySaved: (what: string) => notifier.success(`${what} saved`),
    notifyDeleted: (what: string) => notifier.success(`${what} deleted`),
    notifyError: (message: string) => notifier.error('Could not save', message),
  }
}

/** Contract §3.3: the list is ordered by `name` ASC. */
const byName = (a: Client, b: Client): number => a.name.localeCompare(b.name)

const sortByName = (list: Client[]): Client[] => [...list].sort(byName)