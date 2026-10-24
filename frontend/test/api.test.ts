import { describe, expect, it } from 'vitest'

import { EXPECTED_ERROR_STATUSES, isApiEnvelope, toApiFailure } from '~/types/api'
import { ApiError, toFieldErrors } from '~/composables/useApi'

describe('isApiEnvelope', () => {
  it('recognises success and failure envelopes', () => {
    expect(isApiEnvelope({ success: true, data: [] })).toBe(true)
    expect(isApiEnvelope({ success: false, error: { code: 'NOT_FOUND', message: 'nope' } })).toBe(true)
  })

  it('rejects bare payloads', () => {
    expect(isApiEnvelope([1, 2, 3])).toBe(false)
    expect(isApiEnvelope(null)).toBe(false)
    expect(isApiEnvelope('ok')).toBe(false)
  })
})

describe('toApiFailure', () => {
  it('unwraps the backend error envelope nested under $fetch data', () => {
    const failure = toApiFailure({
      statusCode: 409,
      data: { success: false, error: { code: 'CONFLICT', message: 'Client is referenced by work records.' } },
    })

    expect(failure.code).toBe('CONFLICT')
    expect(failure.message).toBe('Client is referenced by work records.')
  })

  it('maps bare HTTP statuses onto the contracted codes', () => {
    expect(toApiFailure({ statusCode: 400 }).code).toBe('VALIDATION_ERROR')
    expect(toApiFailure({ statusCode: 404 }).code).toBe('NOT_FOUND')
    expect(toApiFailure({ statusCode: 409 }).code).toBe('CONFLICT')
    expect(toApiFailure({ statusCode: 500 }).code).toBe('INTERNAL')
    expect(toApiFailure({ statusCode: 418 }).code).toBe('HTTP_ERROR')
  })

  it('prefers an explicit code over the status mapping', () => {
    expect(toApiFailure({ statusCode: 409, code: 'WEEK_CLOSED', message: 'Week is closed' }).code)
      .toBe('WEEK_CLOSED')
  })

  it('falls back to NETWORK_ERROR for transport failures', () => {
    expect(toApiFailure(new Error('fetch failed')).code).toBe('NETWORK_ERROR')
    expect(toApiFailure(undefined).code).toBe('NETWORK_ERROR')
  })

  it('keeps field-level details for inline form errors', () => {
    const failure = toApiFailure({
      statusCode: 400,
      data: { error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: { billingHour: 'Must be > 0' } } },
    })
    expect(failure.details).toEqual({ billingHour: 'Must be > 0' })
  })
})

describe('toFieldErrors', () => {
  it('collapses the contracted array form into a field map', () => {
    // Contract §1.5: VALIDATION_ERROR details is Array<{ path, message }>.
    const details = [
      { path: 'hours', message: 'Must be <= 24' },
      { path: 'date', message: 'Date 2026-10-26 is outside week 43' },
    ]
    expect(toFieldErrors(details)).toEqual({
      hours: 'Must be <= 24',
      date: 'Date 2026-10-26 is outside week 43',
    })
  })

  it('uses the last segment of a nested Zod path', () => {
    expect(toFieldErrors([{ path: 'paymentPlatform.company', message: 'Unknown platform' }]))
      .toEqual({ company: 'Unknown platform' })
  })

  it('keeps the first error per field', () => {
    const details = [
      { path: 'billingHour', message: 'Must be > 0' },
      { path: 'billingHour', message: 'Must be a number' },
    ]
    expect(toFieldErrors(details)).toEqual({ billingHour: 'Must be > 0' })
  })

  it('also accepts a plain object map', () => {
    expect(toFieldErrors({ name: 'Required' })).toEqual({ name: 'Required' })
  })

  it('ignores shapes it cannot read', () => {
    expect(toFieldErrors(null)).toEqual({})
    expect(toFieldErrors('boom')).toEqual({})
    expect(toFieldErrors([{ nope: 1 }])).toEqual({})
  })
})

describe('ApiError', () => {
  it('exposes string details as field errors', () => {
    const error = new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Invalid payload',
      details: { name: 'Required', billingHour: 42 },
    })

    expect(error.fieldErrors).toEqual({ name: 'Required' })
  })

  it('returns no field errors when details are not a record', () => {
    expect(new ApiError({ code: 'INTERNAL', message: 'boom' }).fieldErrors).toEqual({})
    expect(new ApiError({ code: 'INTERNAL', message: 'boom', details: ['a'] }).fieldErrors).toEqual({})
  })

  it('flags conflicts so the caller can render them calmly', () => {
    expect(new ApiError({ code: 'CONFLICT', message: 'x' }, 409).isConflict).toBe(true)
    expect(new ApiError({ code: 'WEEK_CLOSED', message: 'x' }, 409).isConflict).toBe(true)
    expect(new ApiError({ code: 'INTERNAL', message: 'x' }, 500).isConflict).toBe(false)
  })
})

describe('EXPECTED_ERROR_STATUSES', () => {
  it('covers exactly the 4xx codes the backend contracts', () => {
    expect(EXPECTED_ERROR_STATUSES[400]).toBe('VALIDATION_ERROR')
    expect(EXPECTED_ERROR_STATUSES[404]).toBe('NOT_FOUND')
    expect(EXPECTED_ERROR_STATUSES[409]).toBe('CONFLICT')
  })
})