/**
 * The earnings engine — **pure functions only** (R13).
 *
 * Input: every work record in the requested date range, already annotated by the
 * repository with whether an invoice covers it and what that invoice charged.
 * Output: the `EarningsReport` rows, totals and unbilled figure.
 *
 * Fee model: an invoiced bucket contributes **exactly** the fee its invoice
 * charged, split across its lines in proportion to line amount (largest-remainder,
 * so the split always sums back to the invoice fee). An unbilled bucket gets a
 * notional fee from the same `withFees` rule invoicing uses. This is what makes
 * "earnings by project and by client sum to the invoice totals" true by
 * construction rather than by luck.
 *
 * No I/O — see `reports.engine.test.ts`.
 */
import { fromCents, round2, sumCents, toCents, withFees } from '../../lib/money.js';
import type {
  EarningsGroupBy,
  EarningsReportDto,
  EarningsRowDto,
  EarningsSourceRecord,
} from './reports.types.js';

export const NO_CLIENT_NAME = 'No client';

/**
 * Splits `totalCents` across `weights` in proportion, using the largest-remainder
 * method: every part is floored, then the leftover cents go to the entries with
 * the biggest truncated remainder (ties resolve to the earlier index). The result
 * always sums to exactly `totalCents` — no cent is ever lost or invented.
 */
export function allocateFee(totalCents: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];

  const totalWeight = sumCents(weights);
  if (totalCents === 0 || totalWeight === 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (totalCents * weight) / totalWeight);
  const parts = exact.map((value) => Math.floor(value));
  let remainder = totalCents - sumCents(parts);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const entry of order) {
    if (remainder <= 0) break;
    const current = parts[entry.index];
    if (current === undefined) continue;
    parts[entry.index] = current + 1;
    remainder -= 1;
  }

  return parts;
}

/** An invoicing bucket = one (week, client-bucket) pair, exactly as an invoice is. */
const bucketKey = (record: EarningsSourceRecord): string =>
  `${record.weekId}:${record.clientId === null ? 'none' : record.clientId}`;

function groupIntoBuckets(
  records: readonly EarningsSourceRecord[],
): EarningsSourceRecord[][] {
  const buckets = new Map<string, EarningsSourceRecord[]>();
  for (const record of records) {
    const key = bucketKey(record);
    const existing = buckets.get(key);
    if (existing) existing.push(record);
    else buckets.set(key, [record]);
  }
  return [...buckets.values()];
}

/** The fee this bucket owes, in cents: the invoice's actual fee, or a notional one. */
function bucketFeeCents(bucket: readonly EarningsSourceRecord[], grossCents: number): number {
  const invoiced = bucket.find((record) => record.invoiced && record.invoiceFeeCents !== null);
  if (invoiced?.invoiceFeeCents !== null && invoiced?.invoiceFeeCents !== undefined) {
    return invoiced.invoiceFeeCents;
  }
  const { feePercent, feeFlat } = bucket[0] ?? { feePercent: 0, feeFlat: 0 };
  return withFees(grossCents, feePercent, feeFlat).feeCents;
}

/** Per-record fee split, plus whether the bucket is covered by an issued invoice. */
function splitBucketFees(
  bucket: readonly EarningsSourceRecord[],
): Array<{ record: EarningsSourceRecord; feeCents: number; invoiced: boolean }> {
  const grossCents = bucket.map((record) => record.grossCents);
  const totalGross = sumCents(grossCents);
  const feeCents = bucketFeeCents(bucket, totalGross);
  const parts = allocateFee(feeCents, grossCents);
  const invoiced = bucket.some((record) => record.invoiced);

  return bucket.map((record, index) => ({
    record,
    feeCents: parts[index] ?? 0,
    invoiced,
  }));
}

interface RowAccumulator {
  id: number | null;
  name: string;
  hoursCenti: number;
  grossCents: number;
  feeCents: number;
}

function accumulate(
  rows: Map<string, RowAccumulator>,
  key: string,
  entry: { id: number | null; name: string; record: EarningsSourceRecord; feeCents: number },
): void {
  const existing = rows.get(key);
  if (existing) {
    rows.set(key, {
      ...existing,
      hoursCenti: existing.hoursCenti + toCents(entry.record.hours),
      grossCents: existing.grossCents + entry.record.grossCents,
      feeCents: existing.feeCents + entry.feeCents,
    });
    return;
  }
  rows.set(key, {
    id: entry.id,
    name: entry.name,
    hoursCenti: toCents(entry.record.hours),
    grossCents: entry.record.grossCents,
    feeCents: entry.feeCents,
  });
}

export interface EarningsReportInput {
  records: readonly EarningsSourceRecord[];
  from: string;
  to: string;
  groupBy: EarningsGroupBy;
  currencySymbol: string;
}

/** Builds the complete R13 earnings report. Pure. */
export function buildEarningsReport(input: EarningsReportInput): EarningsReportDto {
  const rows = new Map<string, RowAccumulator>();
  const unbilledWeeks = new Set<number>();
  let unbilledGross = 0;
  let unbilledFees = 0;
  let unbilledHours = 0;

  for (const bucket of groupIntoBuckets(input.records)) {
    const isInvoiced = bucket.some((record) => record.invoiced);

    for (const { record, feeCents } of splitBucketFees(bucket)) {
      accumulate(
        rows,
        input.groupBy === 'client'
          ? `client:${record.clientId === null ? 'none' : record.clientId}`
          : `project:${record.projectId}`,
        input.groupBy === 'client'
          ? { id: record.clientId, name: record.clientName ?? NO_CLIENT_NAME, record, feeCents }
          : { id: record.projectId, name: record.projectName, record, feeCents },
      );

      if (!isInvoiced) {
        unbilledWeeks.add(record.weekId);
        unbilledHours += toCents(record.hours);
        unbilledGross += record.grossCents;
        unbilledFees += feeCents;
      }
    }
  }

  const sorted: EarningsRowDto[] = [...rows.values()]
    .map((row) => {
      const gross = fromCents(row.grossCents);
      const fees = fromCents(row.feeCents);
      return {
        id: row.id,
        name: row.name,
        hours: round2(fromCents(row.hoursCenti)),
        gross: round2(gross),
        fees: round2(fees),
        net: round2(gross - fees),
      };
    })
    .sort((a, b) => b.gross - a.gross || a.name.localeCompare(b.name, 'en'));

  const grossCents = sumCents(sorted.map((row) => toCents(row.gross)));
  const feeCents = sumCents(sorted.map((row) => toCents(row.fees)));
  const hoursCenti = sumCents(sorted.map((row) => toCents(row.hours)));

  return {
    from: input.from,
    to: input.to,
    groupBy: input.groupBy,
    currencySymbol: input.currencySymbol,
    rows: sorted,
    totals: {
      hours: round2(fromCents(hoursCenti)),
      gross: round2(fromCents(grossCents)),
      fees: round2(fromCents(feeCents)),
      net: round2(fromCents(grossCents - feeCents)),
    },
    unbilled: {
      hours: round2(fromCents(unbilledHours)),
      gross: round2(fromCents(unbilledGross)),
      fees: round2(fromCents(unbilledFees)),
      net: round2(fromCents(unbilledGross - unbilledFees)),
      weekCount: unbilledWeeks.size,
    },
  };
}