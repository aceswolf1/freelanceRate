/**
 * Unit tests for `app/composables/useNotifier.ts` — the single toast surface the
 * app talks to.
 *
 * Scenarios covered:
 * - With a PrimeVue toast service present, a notification is pushed with the
 *   right severity, summary, optional detail and lifetime.
 * - Errors live longer (6s) than everything else (3.5s).
 * - A missing detail key is omitted entirely rather than sent as `undefined`.
 * - Without a toast service (SSR / tests / a plugin that failed to load) the
 *   notifier degrades to the console instead of crashing — a missing toast must
 *   never swallow a mutation's error.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNotifier } from '~/composables/useNotifier'

const { toastAdd, toastState } = vi.hoisted(() => ({
  toastAdd: vi.fn(),
  toastState: { available: true },
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => {
    if (!toastState.available) {
      throw new Error('no toast service')
    }
    return { add: toastAdd }
  },
}))

describe('useNotifier — with a toast service', () => {
  beforeEach(() => {
    toastState.available = true
    toastAdd.mockReset()
  })

  it('pushes a success toast with the default lifetime', () => {
    useNotifier().success('Week closed')

    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Week closed',
      life: 3500,
    })
  })

  it('maps every helper onto its own severity', () => {
    const notifier = useNotifier()

    notifier.info('Working')
    notifier.warn('Careful')
    notifier.error('Boom')

    expect(toastAdd.mock.calls.map(call => call[0].severity)).toEqual(['info', 'warn', 'error'])
  })

  it('keeps errors on screen longer than the rest', () => {
    const notifier = useNotifier()

    notifier.success('Saved')
    notifier.error('Could not save')

    expect(toastAdd.mock.calls[0]![0].life).toBe(3500)
    expect(toastAdd.mock.calls[1]![0].life).toBe(6000)
  })

  it('carries the detail through when there is one', () => {
    useNotifier().warn('Cannot change the week status', 'Week 43 already has invoices')

    expect(toastAdd).toHaveBeenCalledWith({
      severity: 'warn',
      summary: 'Cannot change the week status',
      detail: 'Week 43 already has invoices',
      life: 3500,
    })
  })

  it('omits the detail key entirely when no detail was given', () => {
    useNotifier().info('Working')

    const payload = toastAdd.mock.calls[0]![0] as Record<string, unknown>
    expect('detail' in payload).toBe(false)
  })
})

describe('useNotifier — without a toast service', () => {
  beforeEach(() => {
    toastState.available = false
    toastAdd.mockReset()
  })

  it('never touches the toast service', () => {
    useNotifier().success('Week closed')

    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('falls back to the console for warnings and errors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    useNotifier().warn('Cannot change the week status', 'Week 43 already has invoices')
    useNotifier().error('Unexpected error')

    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0]![0]).toContain('[toast:warn] Cannot change the week status')
    expect(warn.mock.calls[0]![0]).toContain('Week 43 already has invoices')
    expect(warn.mock.calls[1]![0]).toContain('[toast:error] Unexpected error')
    expect(info).not.toHaveBeenCalled()

    warn.mockRestore()
    info.mockRestore()
  })

  it('falls back to console.info for the benign severities', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    useNotifier().success('Week closed')
    useNotifier().info('Working')

    expect(info).toHaveBeenCalledTimes(2)
    expect(info.mock.calls[0]![0]).toBe('[toast:success] Week closed')
    expect(warn).not.toHaveBeenCalled()

    info.mockRestore()
    warn.mockRestore()
  })
})
