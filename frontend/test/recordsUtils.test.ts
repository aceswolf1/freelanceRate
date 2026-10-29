/**
 * Unit tests for `app/utils/records.ts` — the small pure helpers that decide how
 * a work record is labelled, coloured and ordered inside a day column.
 *
 * Scenarios covered:
 * - `clientAccent` picks a stable accent per client (and a neutral one for
 *   standalone work).
 * - `hasRateOverride` implements the contract rule "a project rate wins when it
 *   is higher than the client default".
 * - `sortRecords` orders by project name then id **without mutating the input**.
 * - `projectNameOf` / `clientNameOf` degrade to readable placeholders.
 */
import { describe, expect, it } from 'vitest'

import type { ClientSummary, WorkRecord } from '~/types/api'
import {
  clientAccent,
  clientNameOf,
  hasRateOverride,
  projectNameOf,
  sortRecords,
} from '~/utils/records'

const acme: ClientSummary = {
  id: 1,
  name: 'Acme Corp',
  contactEmail: 'billing@acme.example',
  ccEmail: null,
  billingHour: 130,
}

function makeRecord(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: 1,
    weekId: 1,
    projectId: 1,
    project: { id: 1, name: 'E-Commerce Storefront', clientId: 1 },
    clientId: 1,
    client: acme,
    description: 'Checkout flow rebuild',
    hours: 3.5,
    date: '2026-10-19',
    rate: 130,
    lineTotal: 455,
    createdAt: '2026-10-22T18:04:11.120Z',
    updatedAt: '2026-10-22T18:04:11.120Z',
    ...overrides,
  }
}

describe('clientAccent', () => {
  it('gives standalone work the neutral outline accent', () => {
    expect(clientAccent(null)).toBe('border-outline-variant bg-surface-container-highest text-on-surface-variant')
  })

  it('gives every client its own accent and keeps it stable across calls', () => {
    const first = clientAccent(1)
    expect(clientAccent(1)).toBe(first)
    expect(clientAccent(1)).not.toBe(clientAccent(2))
  })

  it('never hands out the neutral accent to a real client', () => {
    const neutral = clientAccent(null)
    for (const id of [0, 1, 2, 3, 4, 5, 10, 42]) {
      expect(clientAccent(id)).not.toBe(neutral)
    }
  })

  it('treats a negative id as its absolute value, so a client keeps its colour', () => {
    expect(clientAccent(-1)).toBe(clientAccent(1))
  })
})

describe('hasRateOverride', () => {
  it('is true when the project rate is higher than the client default', () => {
    expect(hasRateOverride(makeRecord({ rate: 150 }))).toBe(true)
  })

  it('is false when the record uses the client default rate', () => {
    expect(hasRateOverride(makeRecord({ rate: 130 }))).toBe(false)
  })

  it('is false when the record uses a lower rate than the client default', () => {
    expect(hasRateOverride(makeRecord({ rate: 90 }))).toBe(false)
  })

  it('is false for standalone work — there is no client rate to beat', () => {
    expect(hasRateOverride(makeRecord({ clientId: null, client: null, rate: 150 }))).toBe(false)
  })

  it('is false when the client was deleted after the record was written', () => {
    expect(hasRateOverride(makeRecord({ client: null, rate: 150 }))).toBe(false)
  })
})

describe('projectNameOf / clientNameOf', () => {
  it('reads the names off the record', () => {
    const record = makeRecord()
    expect(projectNameOf(record)).toBe('E-Commerce Storefront')
    expect(clientNameOf(record)).toBe('Acme Corp')
  })

  it('degrades to a readable placeholder when the project or client is gone', () => {
    expect(projectNameOf(makeRecord({ project: null }))).toBe('Deleted project')
    expect(clientNameOf(makeRecord({ client: null }))).toBe('Standalone')
  })
})

describe('sortRecords', () => {
  it('orders by project name, then by id inside the same project', () => {
    const sorted = sortRecords([
      makeRecord({ id: 3, project: { id: 2, name: 'Beta', clientId: 1 } }),
      makeRecord({ id: 2, project: { id: 1, name: 'Alpha', clientId: 1 } }),
      makeRecord({ id: 1, project: { id: 1, name: 'Alpha', clientId: 1 } }),
    ])

    expect(sorted.map(r => r.id)).toEqual([1, 2, 3])
  })

  it('does not mutate the array it was given', () => {
    const input = [
      makeRecord({ id: 2, project: { id: 1, name: 'Beta', clientId: 1 } }),
      makeRecord({ id: 1, project: { id: 1, name: 'Alpha', clientId: 1 } }),
    ]
    const copy = [...input]

    sortRecords(input)

    expect(input).toEqual(copy)
  })

  it('returns a new array even when the input is already ordered', () => {
    const input = [makeRecord({ id: 1 })]
    const sorted = sortRecords(input)

    expect(sorted).not.toBe(input)
    expect(sorted).toEqual(input)
  })
})
