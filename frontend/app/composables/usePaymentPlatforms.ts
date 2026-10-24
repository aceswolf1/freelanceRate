import type { PaymentPlatform, PaymentPlatformInput, PaymentPlatformUpdate } from '../types/api'
import { ApiError } from './useApi'

/**
 * Payment platforms (R3) — `GET/POST /api/payment-platforms`,
 * `PATCH/DELETE /api/payment-platforms/:id`.
 *
 * Managed inside `/settings` (the fee-engine section), but kept as its own
 * composable because the clients dialog also needs the list for its platform select.
 */
export function usePaymentPlatformsState() {
  const state = useState<PaymentPlatform[]>('bf:payment-platforms', () => [])
  // `clearNuxtState()` can leave `.value` undefined; consumers must never have
  // to guard every `.map` / `.filter` against that.
  return computed({
    get: () => state.value ?? [],
    set: (value: PaymentPlatform[]) => {
      state.value = value
    },
  })
}

export function usePaymentPlatforms() {
  const platforms = usePaymentPlatformsState()
  const pending = useState<boolean>('bf:payment-platforms:pending', () => false)
  const loaded = useState<boolean>('bf:payment-platforms:loaded', () => false)
  const notifier = useNotifier()

  // Resolved once, here in setup: `useApi()` reads `useRuntimeConfig()`, which needs an
  // active Nuxt instance. Resolving it lazily inside an async function can run
  // after the context is gone (SSR) and throw.
  const api = useApi()

  async function refresh(options: { silent?: boolean, force?: boolean } = {}): Promise<PaymentPlatform[]> {
    if (pending.value || (loaded.value && !options.force)) {
      return platforms.value
    }

    pending.value = true
    try {
      platforms.value = await api.get<PaymentPlatform[]>('/payment-platforms', {
        silent: options.silent ?? false,
      })
      loaded.value = true
    }
    catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'NOT_FOUND') {
        throw error
      }
      platforms.value = []
    }
    finally {
      pending.value = false
    }

    return platforms.value
  }

  async function create(input: PaymentPlatformInput): Promise<PaymentPlatform> {
    const created = await api.post<PaymentPlatform>('/payment-platforms', input, { silent: true })
    platforms.value = sortByCompany([...platforms.value, created])
    return created
  }

  async function update(id: number, patch: PaymentPlatformUpdate): Promise<PaymentPlatform> {
    const updated = await api.patch<PaymentPlatform>(`/payment-platforms/${id}`, patch, { silent: true })
    platforms.value = sortByCompany(
      platforms.value.map(platform => (platform.id === id ? updated : platform)),
    )
    return updated
  }

  /** Contract §3.2: clients referencing the platform get `paymentPlatformId: null`. */
  async function remove(id: number): Promise<void> {
    await api.del(`/payment-platforms/${id}`, { silent: true })
    platforms.value = platforms.value.filter(platform => platform.id !== id)
  }

  const byId = (id: number | null): PaymentPlatform | undefined =>
    id === null ? undefined : platforms.value.find(platform => platform.id === id)

  const options = computed(() => [
    { id: null, company: 'No payment platform' },
    ...platforms.value.map(platform => ({ id: platform.id, company: platform.company })),
  ])

  return {
    platforms,
    pending,
    loaded,
    options,
    refresh,
    create,
    update,
    remove,
    byId,
    notifyError: (message: string) => notifier.error('Could not save', message),
  }
}

/** Contract §3.2: the list is ordered by `company` ASC. */
const byCompany = (a: PaymentPlatform, b: PaymentPlatform): number => a.company.localeCompare(b.company)
const sortByCompany = (list: PaymentPlatform[]): PaymentPlatform[] => [...list].sort(byCompany)