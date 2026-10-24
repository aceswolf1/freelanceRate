import { useToast as usePrimeToast } from 'primevue/usetoast'

export interface NotifierOptions {
  summary: string
  detail?: string
  life?: number
}

/**
 * Global toast surface.
 *
 * Wraps PrimeVue's ToastService so views and composables never import from
 * `primevue/*` directly, and so tests can stub one call site.
 * Named `useNotifier` rather than `useToast` to avoid colliding with the
 * `useToast` the PrimeVue Nuxt module auto-imports.
 *
 * Falls back to the console when the service is unavailable (SSR, tests, or a
 * plugin that failed to load) — a missing toast must never swallow a mutation's
 * error.
 */
export function useNotifier() {
  const prime = safeToast()

  function add(severity: 'success' | 'info' | 'warn' | 'error', options: NotifierOptions): void {
    if (!prime) {
      fallback(severity, options)
      return
    }

    prime.add({
      severity,
      summary: options.summary,
      ...(options.detail === undefined ? {} : { detail: options.detail }),
      life: options.life ?? (severity === 'error' ? 6000 : 3500),
    })
  }

  return {
    success: (summary: string, detail?: string) => add('success', { summary, detail }),
    info: (summary: string, detail?: string) => add('info', { summary, detail }),
    warn: (summary: string, detail?: string) => add('warn', { summary, detail }),
    error: (summary: string, detail?: string) => add('error', { summary, detail }),
  }
}

type PrimeToast = ReturnType<typeof usePrimeToast>

/**
 * `useToast()` calls `inject()`, which warns and yields `undefined` outside a
 * component setup (SSR, unit tests). Treat anything without a callable `add` as
 * "no toast service" so the notifier degrades instead of crashing.
 */
function safeToast(): PrimeToast | null {
  try {
    const toast = usePrimeToast()
    return typeof toast?.add === 'function' ? toast : null
  }
  catch {
    return null
  }
}

function fallback(severity: string, options: NotifierOptions): void {
  const line = `[toast:${severity}] ${options.summary}${options.detail ? ` — ${options.detail}` : ''}`
  if (severity === 'error' || severity === 'warn') {
    console.warn(line)
  }
  else {
    console.info(line)
  }
}