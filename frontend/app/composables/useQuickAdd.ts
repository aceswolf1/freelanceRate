/**
 * Shared "open the quick-add record drawer" **signal**.
 *
 * The header's "Add Time" button lives in the layout, outside the timesheet
 * view, so it cannot drive the drawer directly. It raises this one-way signal
 * instead; the timesheet consumes it.
 *
 * ⚠️ The signal is strictly one-way. `open()` bumps `token`, and a consumer
 * MUST NOT call `open()` in response — doing so re-enters the watcher that
 * observed the bump and spins forever. Consumers copy `date` into their own
 * local state and show the drawer themselves.
 */
export interface QuickAddRequest {
  /** True while a request is outstanding. */
  open: boolean
  /** The day the drawer should open on, or null for "today, inside the week". */
  date: string | null
  /** Increments per request so repeated opens on the same day still re-trigger. */
  token: number
}

export function useQuickAddRequest() {
  return useState<QuickAddRequest>('bf:quick-add', () => ({ open: false, date: null, token: 0 }))
}

export function useQuickAdd() {
  const request = useQuickAddRequest()

  /** Raise the signal. Never call this from inside a watcher of `token`. */
  function open(date: string | null = null): void {
    request.value = { open: true, date, token: request.value.token + 1 }
  }

  /** Clear the signal. Does not change `token`, so it cannot re-trigger a watcher. */
  function close(): void {
    // `request.value` can be momentarily undefined (e.g. the state was cleared
    // out from under a mounted consumer), so read the token defensively.
    request.value = { open: false, date: null, token: request.value?.token ?? 0 }
  }

  return { request, open, close }
}
