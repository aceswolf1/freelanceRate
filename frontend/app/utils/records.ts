import type { WorkRecord } from '../types/api'

/** Stable accent per client id so a client's cards read the same on every day. */
const ACCENTS = [
  'border-tertiary/30 bg-tertiary/15 text-tertiary',
  'border-primary/30 bg-primary/15 text-primary',
  'border-warning/30 bg-warning/15 text-warning',
  'border-outline-variant bg-surface-container-highest text-on-surface-variant',
]

export function clientAccent(clientId: number | null): string {
  if (clientId === null) {
    return ACCENTS[3]!
  }
  return ACCENTS[Math.abs(clientId) % (ACCENTS.length - 1)]!
}

/** Contract: `rateSource === 'project'` means the project overrides its client's rate. */
export function hasRateOverride(record: WorkRecord): boolean {
  return record.clientId !== null && record.client !== null && record.rate > record.client.billingHour
}

/** Sort by project name then id, so a day column reads consistently. */
export function sortRecords(records: WorkRecord[]): WorkRecord[] {
  return [...records].sort(
    (a, b) => projectNameOf(a).localeCompare(projectNameOf(b)) || a.id - b.id,
  )
}

export function projectNameOf(record: WorkRecord): string {
  return record.project?.name ?? 'Deleted project'
}

export function clientNameOf(record: WorkRecord): string {
  return record.client?.name ?? 'Standalone'
}