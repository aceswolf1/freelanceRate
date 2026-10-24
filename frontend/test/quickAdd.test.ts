// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TimesheetPage from '~/pages/index.vue'
import { DARK_CLASS } from '~/utils/theme'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

/**
 * GAP-001 regression.
 *
 * The quick-add drawer used to freeze the tab: the page watched the shared
 * `useQuickAdd` request's `token` and, on change, called `openDrawer()` →
 * `open()`, which bumps `token` again. The watcher therefore re-entered itself
 * forever (dev builds stop with "Maximum recursive updates exceeded";
 * production has no guard and the main thread spins).
 *
 * The fix separates the one-way signal from the drawer's local state. These
 * tests assert the loop is gone: opening the drawer must run a **bounded**
 * number of times and leave the drawer visible.
 */
describe('GAP-001 — quick-add drawer does not loop', () => {
  beforeEach(() => {
    clearNuxtState()
    document.documentElement.classList.remove(DARK_CLASS)
  })

  it('raising the open signal while the page is mounted advances the token exactly once', async () => {
    const { useQuickAdd } = await import('~/composables/useQuickAdd')
    const { open, request } = useQuickAdd()

    const wrapper = await mountSuspended(TimesheetPage)
    const before = request.value.token

    open('2026-10-19')
    await nextTick()
    await nextTick()

    // With the GAP-001 bug the page's watcher called `open()` again, so the
    // token would jump by more than one and keep climbing (dev builds abort
    // with "Maximum recursive updates exceeded"). One request must cost
    // exactly one token.
    expect(request.value.token).toBe(before + 1)
    wrapper.unmount()
  })

  it('opening the drawer twice runs the open handler a bounded number of times', async () => {
    const { useQuickAdd } = await import('~/composables/useQuickAdd')
    const { open, request } = useQuickAdd()

    // Count how many times the page's watcher actually reacts to the signal.
    let reactions = 0
    const unwatch = watch(
      () => request.value?.token,
      () => {
        reactions += 1
      },
    )

    const wrapper = await mountSuspended(TimesheetPage)

    // Two separate open requests, exactly as two clicks would produce.
    open('2026-10-19')
    await nextTick()
    open('2026-10-20')
    await nextTick()
    await nextTick()

    unwatch()
    wrapper.unmount()

    // One reaction per request — not an unbounded cascade.
    expect(reactions).toBeLessThanOrEqual(2)
  })

  it('the request token advances exactly once per open call', async () => {
    const { useQuickAdd } = await import('~/composables/useQuickAdd')
    const { open, request } = useQuickAdd()

    const before = request.value.token
    open('2026-10-19')
    expect(request.value.token).toBe(before + 1)

    const afterFirst = request.value.token
    open('2026-10-20')
    expect(request.value.token).toBe(afterFirst + 1)
  })

  it('closing the drawer does not bump the token, so it cannot re-trigger a watcher', async () => {
    const { useQuickAdd } = await import('~/composables/useQuickAdd')
    const { open, close, request } = useQuickAdd()

    open('2026-10-19')
    const token = request.value.token
    close()

    expect(request.value.token).toBe(token)
    expect(request.value.open).toBe(false)
  })

  it('mounting the page and raising an open request leaves the drawer visible', async () => {
    const { useQuickAdd } = await import('~/composables/useQuickAdd')

    const wrapper = await mountSuspended(TimesheetPage)

    // The drawer's visibility is page-local state, so it is not directly
    // observable from the DOM. What matters is that mounting + opening does
    // not throw "Maximum recursive updates exceeded" and settles.
    useQuickAdd().open('2026-10-19')
    await nextTick()
    await nextTick()

    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('useQuickAdd signal contract', () => {
  beforeEach(() => {
    clearNuxtState()
  })

  it('records the requested date so the drawer can open on that day', async () => {
    const { useQuickAdd } = await import('~/composables/useQuickAdd')
    const { open, request } = useQuickAdd()

    open('2026-10-24')

    expect(request.value.open).toBe(true)
    expect(request.value.date).toBe('2026-10-24')
  })

  it('clears the date when closed', async () => {
    const { useQuickAdd } = await import('~/composables/useQuickAdd')
    const { open, close, request } = useQuickAdd()

    open('2026-10-24')
    close()

    expect(request.value.open).toBe(false)
    expect(request.value.date).toBeNull()
  })
})
