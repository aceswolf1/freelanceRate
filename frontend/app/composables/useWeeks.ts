import type { Week } from '../types/api'
import { ApiError } from './useApi'

/**
 * Weeks (R4, R7, R8) — `GET /api/weeks/current`, `GET /api/weeks/by-date/:date`,
 * `GET /api/weeks/:id`, `POST /api/weeks/:id/close|reopen`.
 *
 * Contract §3.6: both read endpoints are *get-or-create* and always answer 200,
 * so the frontend can call `/weeks/current` on every render without first-load
 * special-casing. Only `GET /api/weeks/:id` 404s on an unknown id.
 */
export function useWeeksState() {
  return useState<Week | null>('bf:week', () => null)
}

export function useWeeks() {
  const week = useWeeksState()
  const pending = useState<boolean>('bf:week:pending', () => false)
  const loaded = useState<boolean>('bf:week:loaded', () => false)
  const notifier = useNotifier()

  // Resolved once, here in setup: `useApi()` reads `useRuntimeConfig()`, which needs an
  // active Nuxt instance. Resolving it lazily inside an async function can run
  // after the context is gone (SSR) and throw.
  const api = useApi()

  async function load(options: { silent?: boolean, force?: boolean } = {}): Promise<Week | null> {
    if (pending.value || (loaded.value && !options.force)) {
      return week.value
    }

    pending.value = true
    try {
      week.value = await api.get<Week>('/weeks/current', { silent: options.silent ?? true })
      loaded.value = true
    }
    catch (error) {
      // Backend not up yet or the weeks module not mounted — keep the placeholder.
      if (!(error instanceof ApiError) || error.code !== 'NOT_FOUND') {
        if (!options.silent) {
          notifier.error('Could not load the current week')
        }
      }
    }
    finally {
      pending.value = false
    }

    return week.value
  }

  /** Week containing an arbitrary date — drives prev/next navigation (contract §3.6). */
  async function loadByDate(date: string): Promise<Week | null> {
    pending.value = true
    try {
      week.value = await api.get<Week>(`/weeks/by-date/${date}`, { silent: true })
      loaded.value = true
    }
    catch {
      week.value = null
    }
    finally {
      pending.value = false
    }

    return week.value
  }

  async function loadById(id: number): Promise<Week | null> {
    pending.value = true
    try {
      week.value = await api.get<Week>(`/weeks/${id}`, { silent: true })
      loaded.value = true
    }
    catch {
      week.value = null
    }
    finally {
      pending.value = false
    }

    return week.value
  }

  async function close(id: number): Promise<Week | null> {
    await api.post(`/weeks/${id}/close`, undefined, { silent: true })
    return loadById(id)
  }

  async function reopen(id: number): Promise<Week | null> {
    await api.post(`/weeks/${id}/reopen`, undefined, { silent: true })
    return loadById(id)
  }

  /** Push a locally-mutated week (used after record CRUD to avoid a refetch). */
  function set(next: Week | null): void {
    week.value = next
    loaded.value = next !== null
  }

  /** Adopt a week fetched during SSR so the first paint already has real data. */
  function hydrate(next: Week | null): void {
    if (loaded.value) {
      return
    }
    set(next)
  }

  const isOpen = computed(() => week.value?.status === 'open')
  const totals = computed(() => week.value?.totals ?? null)

  return {
    week,
    pending,
    loaded,
    isOpen,
    totals,
    load,
    loadByDate,
    loadById,
    close,
    reopen,
    set,
    hydrate,
  }
}

/**
 * Server-rendered current week.
 *
 * `/weeks/current` is get-or-create and always 200 (contract §3.6), so it is
 * safe to call during SSR — that removes the client-side loading flash on the
 * timesheet and makes the page meaningful before hydration.
 *
 * Returns `null` rather than throwing when the API is down, so the rest of the
 * shell still renders.
 */
export function useCurrentWeekAsync() {
  // Resolved here rather than inside the handler, for the same reason as in
  // `useWeeks`: `useApi()` needs an active Nuxt instance.
  const api = useApi()

  return useAsyncData<Week | null>(
    'bf:week:current',
    () => api.get<Week>('/weeks/current', { silent: true }).catch(() => null),
    { server: true, default: () => null },
  )
}

/** Alias used by the shell components written before the contract landed. */
export function useActiveWeek() {
  return useWeeks()
}