/**
 * Wire DTOs for the earnings report (contract §4.8).
 *
 * Money is a number in major units; hours have up to 2 decimals.
 */

export type EarningsGroupBy = 'project' | 'client';

export interface EarningsRowDto {
  /** `null` for the "No client" bucket when grouping by client. */
  id: number | null;
  name: string;
  hours: number;
  gross: number;
  fees: number;
  net: number;
}

export interface EarningsTotalsDto {
  hours: number;
  gross: number;
  fees: number;
  net: number;
}

/**
 * Additive extension to the contract's `EarningsReport` — the hours that exist
 * as records but are not covered by any issued invoice yet. Recorded in the
 * contract's `## Deviations` table.
 */
export interface EarningsUnbilledDto extends EarningsTotalsDto {
  weekCount: number;
}

export interface EarningsReportDto {
  from: string;
  to: string;
  groupBy: EarningsGroupBy;
  currencySymbol: string;
  rows: EarningsRowDto[];
  totals: EarningsTotalsDto;
  unbilled: EarningsUnbilledDto;
}

/** One work record with its invoiced-state resolved by the repository. */
export interface EarningsSourceRecord {
  recordId: number;
  weekId: number;
  clientId: number | null;
  clientName: string | null;
  projectId: number;
  projectName: string;
  /** Snapshot hours when the record is invoiced, otherwise the record's own hours. */
  hours: number;
  /** Snapshot rate when invoiced, otherwise the effective rate at read time. */
  rate: number;
  /** Line total in **integer cents** — the fee allocation weight. */
  grossCents: number;
  feePercent: number;
  feeFlat: number;
  invoiced: boolean;
  /** The covering invoice's fee in cents; `null` when not invoiced. */
  invoiceFeeCents: number | null;
}