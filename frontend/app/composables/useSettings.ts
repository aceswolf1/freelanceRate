import type { Settings, SettingsUpdate } from '../types/api'
import { ApiError } from './useApi'

/**
 * Settings singleton (R15) — `GET /api/settings` (creates the row on first call)
 * and `PUT /api/settings` (partial).
 *
 * The sidebar user card, the timesheet target banner and every money formatter
 * read the currency symbol from here, so this state is app-wide.
 */
export const SETTINGS_FALLBACK: Settings = {
  id: 1,
  displayName: 'Consultant',
  weeklyTargetHours: 40,
  currencySymbol: '$',
  invoicePrefix: 'INV',
  emailShowRate: false,
  emailShowGross: false,
  emailShowFee: false,
  updatedAt: '',
}

export function useSettingsState() {
  const state = useState<Settings>('bf:settings', () => ({ ...SETTINGS_FALLBACK }))
  // `clearNuxtState()` can leave `.value` undefined; fall back to the defaults
  // so the shell still renders rather than crashing on a cleared state.
  return computed({
    get: () => state.value ?? { ...SETTINGS_FALLBACK },
    set: (value: Settings) => {
      state.value = value
    },
  })
}

/**
 * The in-flight settings request.
 *
 * GAP-007: a forced load used to return the fallback while a request was
 * already in flight, so the Settings form could be seeded with "Consultant"
 * and then overwrite the real "Alex Morgan" on save.
 *
 * Module-scoped rather than `useState`, because `useState` is serialised into
 * the SSR payload and a Promise does not belong there. It is only used on the
 * client: `load()` is called from client-side lifecycle hooks, and on the server
 * each request gets its own fetch so concurrent SSR requests never share one.
 */
let inflight: Promise<Settings> | null = null

export function useSettings() {
  const settings = useSettingsState()
  const pending = useState<boolean>('bf:settings:pending', () => false)
  const loaded = useState<boolean>('bf:settings:loaded', () => false)
  const notifier = useNotifier()

  // Resolved once, here in setup: `useApi()` reads `useRuntimeConfig()`, which needs an
  // active Nuxt instance. Resolving it lazily inside an async function can run
  // after the context is gone (SSR) and throw.
  const api = useApi()

  async function load(options: { force?: boolean, silent?: boolean } = {}): Promise<Settings> {
    if (loaded.value && !options.force) {
      return settings.value
    }

    // A forced load must await the request that is already running rather than
    // hand back the fallback.
    if (import.meta.client && inflight) {
      return inflight
    }

    pending.value = true

    const request = (async (): Promise<Settings> => {
      try {
        settings.value = await api.get<Settings>('/settings', { silent: options.silent ?? true })
        loaded.value = true
      }
      catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'NOT_FOUND') {
          // Swallow: the API may simply not be running yet (Phase A / first boot).
          // The fallback values keep every view renderable.
        }
      }
      finally {
        pending.value = false
      }

      return settings.value
    })()

    if (import.meta.client) {
      inflight = request
      void request.finally(() => {
        if (inflight === request) {
          inflight = null
        }
      })
    }

    return request
  }

  async function save(patch: SettingsUpdate): Promise<Settings> {
    const updated = await api.put<Settings>('/settings', patch, { silent: true })
    settings.value = updated
    return updated
  }

  /** Adopt settings fetched during SSR, so the first paint already has real values. */
  function set(next: Settings): void {
    settings.value = next
    loaded.value = true
  }

  const displayName = computed(() => settings.value.displayName || SETTINGS_FALLBACK.displayName)
  const currencySymbol = computed(() => settings.value.currencySymbol || SETTINGS_FALLBACK.currencySymbol)
  const weeklyTargetHours = computed(() => settings.value.weeklyTargetHours ?? SETTINGS_FALLBACK.weeklyTargetHours)
  const invoicePrefix = computed(() => settings.value.invoicePrefix || SETTINGS_FALLBACK.invoicePrefix)
  const role = 'Freelance Consultant'

  return {
    settings,
    pending,
    loaded,
    displayName,
    currencySymbol,
    weeklyTargetHours,
    invoicePrefix,
    role,
    load,
    save,
    set,
    notifySaved: () => notifier.success('Settings saved'),
    notifyError: (message: string) => notifier.error('Could not save settings', message),
  }
}

/**
 * Alias kept for the shell components written before the contract landed.
 * Identical surface — `useProfile().load()` is `useSettings().load()`.
 */
export function useProfile() {
  return useSettings()
}