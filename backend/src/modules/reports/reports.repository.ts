/**
 * Repository (data access) for the earnings report.
 *
 * One joined query returns every record in the range together with the invoice
 * (and invoice line) that covers it, so the service never has to re-query per
 * row. Invoiced records contribute their **snapshotted** hours/rate/line total;
 * uninvoiced records fall back to the effective rate at read time.
 */
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  clients,
  invoiceLines,
  invoices,
  paymentPlatforms,
  projects,
  settings,
  workRecords,
} from '../../db/schema/index.js';
import { mulHoursRate, toCents } from '../../lib/money.js';
import type { EarningsSourceRecord } from './reports.types.js';

/** Earliest and latest record dates — the contract's defaults for `from` / `to`. */
export interface DateBounds {
  from: string | null;
  to: string | null;
}

export class ReportsRepository {
  constructor(private readonly db: Database) {}

  async readBounds(): Promise<DateBounds> {
    const [row] = await this.db
      .select({ from: sql<Date | null>`min(${workRecords.date})`, to: sql<Date | null>`max(${workRecords.date})` })
      .from(workRecords);
    return { from: toIsoDate(row?.from), to: toIsoDate(row?.to) };
  }

  async readCurrencySymbol(): Promise<string> {
    const [row] = await this.db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    return row?.currencySymbol ?? '$';
  }

  async readRecords(from: string, to: string): Promise<EarningsSourceRecord[]> {
    const rows = await this.db
      .select({
        recordId: workRecords.id,
        weekId: workRecords.weekId,
        clientId: workRecords.clientId,
        clientName: clients.name,
        projectId: projects.id,
        projectName: projects.name,
        projectBillingHour: projects.billingHour,
        clientBillingHour: clients.billingHour,
        recordHours: workRecords.hours,
        feePercent: paymentPlatforms.feePercent,
        feeFlat: paymentPlatforms.feeFlat,
        invoiceId: invoices.id,
        invoiceFee: invoices.feeAmount,
        lineHours: invoiceLines.hours,
        lineRate: invoiceLines.rate,
        lineTotal: invoiceLines.lineTotal,
      })
      .from(workRecords)
      .innerJoin(projects, eq(workRecords.projectId, projects.id))
      .leftJoin(clients, eq(workRecords.clientId, clients.id))
      .leftJoin(paymentPlatforms, eq(clients.paymentPlatformId, paymentPlatforms.id))
      // `is not distinct from` also matches the NULL "No client" bucket.
      .leftJoin(
        invoices,
        and(
          eq(invoices.weekId, workRecords.weekId),
          sql`${invoices.clientId} is not distinct from ${workRecords.clientId}`,
        ),
      )
      .leftJoin(
        invoiceLines,
        and(eq(invoiceLines.invoiceId, invoices.id), eq(invoiceLines.recordId, workRecords.id)),
      )
      .where(and(gte(workRecords.date, from), lte(workRecords.date, to)))
      .orderBy(asc(workRecords.date), asc(workRecords.id));

    return rows.map((row) => {
      const invoiced = row.invoiceId !== null;
      // The DB CHECK guarantees a project or client rate exists; `?? 0` only
      // guards a report from 500-ing on data that violates it.
      const rate = row.lineRate ?? row.projectBillingHour ?? row.clientBillingHour ?? 0;
      const hours = row.lineHours ?? row.recordHours;

      return {
        recordId: row.recordId,
        weekId: row.weekId,
        clientId: row.clientId,
        clientName: row.clientName,
        projectId: row.projectId,
        projectName: row.projectName,
        hours,
        rate,
        grossCents:
          row.lineTotal !== null ? toCents(row.lineTotal) : mulHoursRate(hours, rate),
        feePercent: row.feePercent ?? 0,
        feeFlat: row.feeFlat ?? 0,
        invoiced,
        invoiceFeeCents: invoiced ? toCents(row.invoiceFee ?? 0) : null,
      };
    });
  }
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}