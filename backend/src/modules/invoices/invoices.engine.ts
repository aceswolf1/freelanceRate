/**
 * The invoice engine — **pure functions only**.
 *
 * Input: one week worth of work records (already joined with project/client
 * rates and payment-platform fees) + the week's settings.
 * Output: one *draft* invoice per client bucket, plus the week totals used by
 * both the preview and the earnings report.
 *
 * No I/O, no database, no framework — every money rule below is exercised
 * directly by `invoices.engine.test.ts`. All arithmetic happens in integer
 * cents (`lib/money.ts`); decimals only appear on the way out.
 */
import { fromCents, mulHoursRate, round2, sumCents, toCents, withFees } from '../../lib/money.js';

/** Bucket label used for standalone projects (`client_id IS NULL`). */
export const NO_CLIENT_NAME = 'No client';

export type WeekStatus = 'open' | 'closed';
export type WarningCode = 'WEEK_OPEN' | 'BELOW_TARGET' | 'NO_RECORDS';

/** Client-facing invoicing facts, flattened with the payment platform fee. */
export interface EngineClient {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string;
  ccEmail: string | null;
  feePercent: number;
  feeFlat: number;
  platformCompany: string | null;
}

/** One work record with both candidate hourly rates already resolved by the repository. */
export interface EngineRecord {
  id: number;
  date: string;
  hours: number;
  description: string;
  projectId: number;
  projectName: string;
  clientId: number | null;
  /** Project rate override — wins when present. */
  projectBillingHour: number | null;
  /** Client rate, used when the project has no override. */
  clientBillingHour: number | null;
}

export interface EngineSettings {
  weeklyTargetHours: number;
}

export interface EngineInput {
  records: readonly EngineRecord[];
  clients: readonly EngineClient[];
  settings: EngineSettings;
}

export interface EngineDraftLine {
  recordId: number;
  date: string;
  projectId: number;
  projectName: string;
  description: string;
  hours: number;
  rate: number;
  lineTotal: number;
}

export interface EngineDraftSubtotal {
  projectId: number;
  projectName: string;
  hours: number;
  gross: number;
}

export interface EngineDraft {
  clientId: number | null;
  clientName: string;
  contactName: string | null;
  contactEmail: string;
  ccEmail: string | null;
  platformCompany: string | null;
  feePercent: number;
  feeFlat: number;
  totalHours: number;
  gross: number;
  feeAmount: number;
  net: number;
  lines: EngineDraftLine[];
  subtotals: EngineDraftSubtotal[];
}

export interface EngineProjectTotal {
  projectId: number;
  projectName: string;
  clientId: number | null;
  clientName: string | null;
  rate: number;
  hours: number;
  gross: number;
}

export interface EngineClientTotal {
  clientId: number | null;
  clientName: string | null;
  hours: number;
  gross: number;
}

export interface EngineTotals {
  totalHours: number;
  projectedGross: number;
  targetHours: number;
  belowTarget: boolean;
  hoursBelowTarget: number;
  clientCount: number;
  recordCount: number;
  byProject: EngineProjectTotal[];
  byClient: EngineClientTotal[];
}

export interface EngineResult {
  drafts: EngineDraft[];
  totals: EngineTotals;
}

export interface EngineWarning {
  code: WarningCode;
  message: string;
}

/**
 * Effective rate (R2): `project.billing_hour ?? client.billing_hour`.
 * The DB CHECK constraints guarantee one of the two exists; a record that
 * reaches this function without either is a data-integrity fault, so it fails
 * loudly instead of silently invoicing at zero.
 */
export function effectiveRateFor(record: EngineRecord): number {
  const rate = record.projectBillingHour ?? record.clientBillingHour;
  if (rate === null || rate === undefined) {
    throw new Error(
      `Cannot resolve an hourly rate for work record ${record.id} ` +
        `(project "${record.projectName}" has neither a project nor a client rate)`,
    );
  }
  return rate;
}

function toLine(record: EngineRecord): EngineDraftLine {
  const rate = effectiveRateFor(record);
  return {
    recordId: record.id,
    date: record.date,
    projectId: record.projectId,
    projectName: record.projectName,
    description: record.description,
    hours: round2(record.hours),
    rate,
    lineTotal: fromCents(mulHoursRate(record.hours, rate)),
  };
}

/** Lines are chronological; the record id breaks same-day ties deterministically. */
function compareRecords(a: EngineRecord, b: EngineRecord): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id - b.id;
}

interface ClientBucket {
  clientId: number | null;
  records: EngineRecord[];
}

/** One bucket per client; every standalone project shares the `null` bucket. */
function groupByClient(records: readonly EngineRecord[]): ClientBucket[] {
  const buckets = new Map<string, ClientBucket>();
  for (const record of records) {
    const key = record.clientId === null ? 'none' : `client:${record.clientId}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.records.push(record);
      continue;
    }
    buckets.set(key, { clientId: record.clientId, records: [record] });
  }
  return [...buckets.values()];
}

/** Per-project hours + gross, ordered by first appearance in the date-sorted lines. */
function buildSubtotals(lines: readonly EngineDraftLine[]): EngineDraftSubtotal[] {
  const groups: EngineDraftSubtotal[] = [];
  const indexByProject = new Map<number, number>();

  for (const line of lines) {
    const index = indexByProject.get(line.projectId);
    if (index === undefined) {
      indexByProject.set(line.projectId, groups.length);
      groups.push({
        projectId: line.projectId,
        projectName: line.projectName,
        hours: line.hours,
        gross: line.lineTotal,
      });
      continue;
    }
    const current = groups[index];
    if (!current) continue;
    groups[index] = {
      ...current,
      hours: round2(current.hours + line.hours),
      gross: round2(current.gross + line.lineTotal),
    };
  }
  return groups;
}

function buildDraft(
  bucket: ClientBucket,
  clientsById: ReadonlyMap<number, EngineClient>,
): EngineDraft {
  const lines = [...bucket.records].sort(compareRecords).map(toLine);
  const subtotals = buildSubtotals(lines);
  // A null client bucket has no platform: no fee, no address, "No client" label.
  const source = bucket.clientId === null ? undefined : clientsById.get(bucket.clientId);
  const grossCents = sumCents(lines.map((line) => toCents(line.lineTotal)));
  const feePercent = source?.feePercent ?? 0;
  const feeFlat = source?.feeFlat ?? 0;
  const { feeCents, netCents } = withFees(grossCents, feePercent, feeFlat);

  return {
    clientId: bucket.clientId,
    clientName: source?.name ?? NO_CLIENT_NAME,
    contactName: source?.contactName ?? null,
    contactEmail: source?.contactEmail ?? '',
    ccEmail: source?.ccEmail ?? null,
    platformCompany: source?.platformCompany ?? null,
    feePercent,
    feeFlat,
    totalHours: round2(lines.reduce((total, line) => total + line.hours, 0)),
    gross: fromCents(grossCents),
    feeAmount: fromCents(feeCents),
    net: fromCents(netCents),
    lines,
    subtotals,
  };
}

/** Client buckets by name; the "No client" bucket always sorts last. */
function compareDrafts(a: EngineDraft, b: EngineDraft): number {
  if (a.clientId === null) return b.clientId === null ? 0 : 1;
  if (b.clientId === null) return -1;
  return a.clientName.localeCompare(b.clientName, 'en');
}

function buildProjectTotals(drafts: readonly EngineDraft[]): EngineProjectTotal[] {
  const totals: EngineProjectTotal[] = [];
  const indexByProject = new Map<number, number>();

  for (const draft of drafts) {
    const clientName = draft.clientId === null ? null : draft.clientName;
    for (const line of draft.lines) {
      const index = indexByProject.get(line.projectId);
      if (index === undefined) {
        indexByProject.set(line.projectId, totals.length);
        totals.push({
          projectId: line.projectId,
          projectName: line.projectName,
          clientId: draft.clientId,
          clientName,
          rate: line.rate,
          hours: line.hours,
          gross: line.lineTotal,
        });
        continue;
      }
      const current = totals[index];
      if (!current) continue;
      totals[index] = {
        ...current,
        hours: round2(current.hours + line.hours),
        gross: round2(current.gross + line.lineTotal),
      };
    }
  }
  return totals;
}

function buildTotals(
  drafts: readonly EngineDraft[],
  records: readonly EngineRecord[],
  settings: EngineSettings,
): EngineTotals {
  const totalHours = round2(records.reduce((total, record) => total + record.hours, 0));
  const projectedGross = fromCents(sumCents(drafts.map((draft) => toCents(draft.gross))));
  const targetHours = settings.weeklyTargetHours;
  const hoursBelowTarget = round2(Math.max(0, targetHours - totalHours));
  const distinctClients = new Set(
    records.map((record) => record.clientId).filter((id): id is number => id !== null),
  );

  return {
    totalHours,
    projectedGross,
    targetHours,
    belowTarget: totalHours < targetHours,
    hoursBelowTarget,
    clientCount: distinctClients.size,
    recordCount: records.length,
    byProject: buildProjectTotals(drafts),
    byClient: drafts.map((draft) => ({
      clientId: draft.clientId,
      clientName: draft.clientId === null ? null : draft.clientName,
      hours: draft.totalHours,
      gross: draft.gross,
    })),
  };
}

/**
 * Builds the invoice drafts for a week. Pure — the caller decides whether to
 * preview them (nothing is persisted) or to persist them.
 */
export function buildInvoiceDrafts(input: EngineInput): EngineResult {
  const clientsById = new Map(input.clients.map((entry) => [entry.id, entry] as const));
  const drafts = groupByClient(input.records)
    .map((bucket) => buildDraft(bucket, clientsById))
    .sort(compareDrafts);

  return { drafts, totals: buildTotals(drafts, input.records, input.settings) };
}

/**
 * R8 preview warnings. An empty week reports `NO_RECORDS` instead of the
 * below-target banner — "0 / 40 hrs, -40 below target" is noise.
 */
export function buildWarnings(input: {
  weekNumber: number;
  status: WeekStatus;
  totals: EngineTotals;
}): EngineWarning[] {
  const { weekNumber, status, totals } = input;
  const warnings: EngineWarning[] = [];

  if (status === 'open') {
    warnings.push({ code: 'WEEK_OPEN', message: `Close week ${weekNumber} before generating invoices` });
  }
  if (totals.recordCount === 0) {
    warnings.push({ code: 'NO_RECORDS', message: `Week ${weekNumber} has no records to invoice` });
  } else if (totals.belowTarget) {
    warnings.push({
      code: 'BELOW_TARGET',
      message: `${totals.totalHours} / ${totals.targetHours} hrs, -${totals.hoursBelowTarget} below target`,
    });
  }

  return warnings;
}