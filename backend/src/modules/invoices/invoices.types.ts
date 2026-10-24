/**
 * Wire DTOs for the invoice + earnings endpoints.
 *
 * Mirrors §2 of `orchestration-ctx/decisions/api-contract.md` exactly — the
 * frontend's `types/api.ts` is generated from the same shapes.
 *
 * Money is a plain **number** in major units (`2275` = $2,275.00); hours are
 * numbers with up to 2 decimals. Dates are `YYYY-MM-DD` strings, timestamps are
 * ISO-8601 UTC strings. No `Date` objects cross this boundary.
 */

export type WeekStatus = 'open' | 'closed';
export type RateSource = 'project' | 'client';
export type WarningCode = 'WEEK_OPEN' | 'BELOW_TARGET' | 'NO_RECORDS';

export interface ClientSummaryDto {
  id: number;
  name: string;
  contactEmail: string;
  ccEmail: string | null;
  billingHour: number;
}

export interface WeekProjectTotalDto {
  projectId: number;
  projectName: string;
  clientId: number | null;
  clientName: string | null;
  rate: number;
  hours: number;
  gross: number;
}

export interface WeekClientTotalDto {
  clientId: number | null;
  clientName: string | null;
  hours: number;
  gross: number;
}

export interface WeekTotalsDto {
  totalHours: number;
  projectedGross: number;
  targetHours: number;
  belowTarget: boolean;
  hoursBelowTarget: number;
  clientCount: number;
  recordCount: number;
  byProject: WeekProjectTotalDto[];
  byClient: WeekClientTotalDto[];
}

export interface InvoiceLineDto {
  id: number;
  recordId: number | null;
  date: string;
  projectId: number | null;
  projectName: string;
  description: string;
  hours: number;
  rate: number;
  lineTotal: number;
}

export interface InvoiceSubtotalDto {
  projectId: number | null;
  projectName: string;
  hours: number;
  gross: number;
}

export interface InvoiceDto {
  id: number;
  number: string;
  weekId: number;
  clientId: number | null;
  clientName: string;
  contactEmail: string;
  ccEmail: string | null;
  platformCompany: string | null;
  feePercent: number;
  feeFlat: number;
  totalHours: number;
  gross: number;
  feeAmount: number;
  net: number;
  currencySymbol: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  lines: InvoiceLineDto[];
  subtotals: InvoiceSubtotalDto[];
}

export interface InvoiceWarningDto {
  code: WarningCode;
  message: string;
}

/** A preview line has no persisted id yet. */
export type InvoicePreviewLineDto = Omit<InvoiceLineDto, 'id'>;

export interface InvoicePreviewRowDto {
  clientId: number | null;
  clientName: string;
  contactEmail: string;
  ccEmail: string | null;
  platformCompany: string | null;
  feePercent: number;
  feeFlat: number;
  totalHours: number;
  gross: number;
  feeAmount: number;
  net: number;
  lines: InvoicePreviewLineDto[];
  subtotals: InvoiceSubtotalDto[];
}

export interface InvoicePreviewDto {
  weekId: number;
  periodStart: string;
  periodEnd: string;
  status: WeekStatus;
  canGenerate: boolean;
  currencySymbol: string;
  totals: WeekTotalsDto;
  warnings: InvoiceWarningDto[];
  invoices: InvoicePreviewRowDto[];
}

export interface InvoiceEmailDraftDto {
  to: string;
  cc: string | null;
  subject: string;
  text: string;
  html: string;
  mailto: string;
  truncated: boolean;
}