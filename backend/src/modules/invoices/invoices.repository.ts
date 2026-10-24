/**
 * Repository (data access) for invoicing.
 *
 * Every SQL statement lives here — services never build queries, controllers
 * never touch the database. Queries avoid N+1: the week source is a single
 * joined read, and invoice lines are fetched in one batched query.
 */
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  clients,
  invoiceLines,
  invoices,
  paymentPlatforms,
  projects,
  settings,
  weeks,
  workRecords,
} from '../../db/schema/index.js';
import { addDays } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import type { EngineClient, EngineRecord } from './invoices.engine.js';
import type { InvoiceDto, InvoiceLineDto, InvoiceSubtotalDto } from './invoices.types.js';

/** The week + every record the engine needs, with both candidate rates resolved. */
export interface WeekInvoiceSource {
  week: { id: number; startDate: string; status: 'open' | 'closed' };
  periodStart: string;
  periodEnd: string;
  settings: {
    displayName: string;
    weeklyTargetHours: number;
    currencySymbol: string;
    invoicePrefix: string;
  };
  records: EngineRecord[];
  clients: EngineClient[];
}

type InvoiceRow = typeof invoices.$inferSelect;
type InvoiceLineRow = typeof invoiceLines.$inferSelect;

export interface InvoiceInsert {
  row: typeof invoices.$inferInsert;
  lines: (typeof invoiceLines.$inferInsert)[];
}

export const weekPeriod = (startDate: string): { start: string; end: string } => ({
  start: startDate,
  end: addDays(startDate, 6),
});

/** Per-project hours + gross derived from the lines — same rule as the engine. */
function buildSubtotals(lines: readonly InvoiceLineDto[]): InvoiceSubtotalDto[] {
  const totals: InvoiceSubtotalDto[] = [];
  const indexByProject = new Map<string, number>();

  for (const line of lines) {
    const key = line.projectId === null ? `name:${line.projectName}` : `id:${line.projectId}`;
    const index = indexByProject.get(key);
    if (index === undefined) {
      indexByProject.set(key, totals.length);
      totals.push({
        projectId: line.projectId,
        projectName: line.projectName,
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
  return totals;
}

export class InvoicesRepository {
  constructor(private readonly db: Database) {}

  /**
   * Runs `work` inside a single transaction, handing it a repository bound to
   * the transaction handle. Drizzle's `PgTransaction` exposes the same
   * query-builder surface this repository uses (`select` / `insert` / `execute`),
   * so the two are interchangeable here.
   */
  async runInTransaction<T>(work: (repo: InvoicesRepository) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work(new InvoicesRepository(tx as unknown as Database)),
    );
  }

  /** Settings singleton — created on first read so a fresh DB never 500s. */
  async readSettings(): Promise<WeekInvoiceSource['settings']> {
    const [existing] = await this.db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    if (existing) return toSettings(existing);

    const [created] = await this.db
      .insert(settings)
      .values({ id: 1 })
      .onConflictDoNothing()
      .returning();
    if (!created) throw new Error('Settings row is missing and could not be created');
    return toSettings(created);
  }

  async findWeek(
    weekId: number,
  ): Promise<{ id: number; startDate: string; status: 'open' | 'closed' } | null> {
    const [row] = await this.db
      .select({ id: weeks.id, startDate: weeks.startDate, status: weeks.status })
      .from(weeks)
      .where(eq(weeks.id, weekId))
      .limit(1);
    return row ?? null;
  }

  /**
   * One query for the whole week: every record joined to its project, client and
   * payment platform, so the engine never has to ask for more. Clients are read
   * once for the whole table (a single-user app — a few dozen rows at most).
   */
  async readWeekSource(weekId: number): Promise<WeekInvoiceSource | null> {
    const week = await this.findWeek(weekId);
    if (!week) return null;

    const [recordRows, clientRows, currentSettings] = await Promise.all([
      this.db
        .select({
          id: workRecords.id,
          date: workRecords.date,
          hours: workRecords.hours,
          description: workRecords.description,
          projectId: projects.id,
          projectName: projects.name,
          projectBillingHour: projects.billingHour,
          clientId: workRecords.clientId,
          clientBillingHour: clients.billingHour,
        })
        .from(workRecords)
        .innerJoin(projects, eq(workRecords.projectId, projects.id))
        .leftJoin(clients, eq(workRecords.clientId, clients.id))
        .where(eq(workRecords.weekId, weekId))
        .orderBy(asc(workRecords.date), asc(workRecords.id)),
      this.db
        .select({
          id: clients.id,
          name: clients.name,
          contactEmail: clients.contactEmail,
          ccEmail: clients.ccEmail,
          platformCompany: paymentPlatforms.company,
          feePercent: paymentPlatforms.feePercent,
          feeFlat: paymentPlatforms.feeFlat,
        })
        .from(clients)
        .leftJoin(paymentPlatforms, eq(clients.paymentPlatformId, paymentPlatforms.id)),
      this.readSettings(),
    ]);

    const period = weekPeriod(week.startDate);
    return {
      week,
      periodStart: period.start,
      periodEnd: period.end,
      settings: currentSettings,
      records: recordRows.map(toEngineRecord),
      clients: clientRows.map((row) => ({
        id: row.id,
        name: row.name,
        contactEmail: row.contactEmail,
        ccEmail: row.ccEmail,
        platformCompany: row.platformCompany,
        feePercent: row.feePercent ?? 0,
        feeFlat: row.feeFlat ?? 0,
      })),
    };
  }

  /** Highest sequence already issued for `{prefix}-{year}-`, so numbering can continue. */
  async readLastSequence(prefix: string, year: number): Promise<number> {
    const stem = `${prefix}-${year}-`;
    const rows = await this.db
      .select({ number: invoices.number })
      .from(invoices)
      .where(sql`${invoices.number} like ${`${stem}%`}`);

    return rows.reduce((max, row) => {
      const parsed = Number.parseInt(row.number.slice(stem.length), 10);
      return Number.isFinite(parsed) && parsed > max ? parsed : max;
    }, 0);
  }

  /** Locks the week row so two concurrent generates cannot both insert. */
  async lockWeek(weekId: number): Promise<void> {
    await this.db.execute(sql`select id from weeks where id = ${weekId} for update`);
  }

  async insertInvoice(row: typeof invoices.$inferInsert): Promise<InvoiceRow> {
    const [inserted] = await this.db.insert(invoices).values(row).returning();
    if (!inserted) throw new Error(`Failed to persist invoice for week ${row.weekId}`);
    return inserted;
  }

  async insertLines(rows: (typeof invoiceLines.$inferInsert)[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(invoiceLines).values(rows);
  }

  /** Week's invoices with lines, ordered by invoice number ASC (contract §4.2). */
  async listByWeek(weekId: number): Promise<InvoiceDto[]> {
    return this.hydrate(weekId, null);
  }

  async findById(invoiceId: number): Promise<InvoiceDto | null> {
    const [hydrated] = await this.hydrate(null, invoiceId);
    return hydrated ?? null;
  }

  /** Batch-loads invoices + their lines; one query each, never one per invoice. */
  private async hydrate(weekId: number | null, invoiceId: number | null): Promise<InvoiceDto[]> {
    const condition =
      weekId !== null ? eq(invoices.weekId, weekId) : eq(invoices.id, invoiceId as number);

    const invoiceRows = await this.db
      .select({ row: invoices, startDate: weeks.startDate })
      .from(invoices)
      .innerJoin(weeks, eq(invoices.weekId, weeks.id))
      .where(condition)
      .orderBy(asc(invoices.number));

    if (invoiceRows.length === 0) return [];

    const [lineRows, currentSettings] = await Promise.all([
      this.db
        .select()
        .from(invoiceLines)
        .where(
          inArray(
            invoiceLines.invoiceId,
            invoiceRows.map((entry) => entry.row.id),
          ),
        )
        .orderBy(asc(invoiceLines.date), asc(invoiceLines.id)),
      this.readSettings(),
    ]);

    const linesByInvoice = new Map<number, InvoiceLineRow[]>();
    for (const line of lineRows) {
      const bucket = linesByInvoice.get(line.invoiceId);
      if (bucket) bucket.push(line);
      else linesByInvoice.set(line.invoiceId, [line]);
    }

    return invoiceRows.map(({ row, startDate }) => {
      const lines: InvoiceLineDto[] = (linesByInvoice.get(row.id) ?? []).map((line) => ({
        id: line.id,
        recordId: line.recordId,
        date: line.date,
        projectId: line.projectId,
        projectName: line.projectNameSnapshot,
        description: line.description,
        hours: line.hours,
        rate: line.rate,
        lineTotal: line.lineTotal,
      }));

      return {
        id: row.id,
        number: row.number,
        weekId: row.weekId,
        clientId: row.clientId,
        clientName: row.clientNameSnapshot,
        contactEmail: row.contactEmailSnapshot,
        ccEmail: row.ccEmailSnapshot,
        platformCompany: row.platformCompanySnapshot,
        feePercent: row.feePercent,
        feeFlat: row.feeFlat,
        totalHours: row.totalHours,
        gross: row.gross,
        feeAmount: row.feeAmount,
        net: row.net,
        currencySymbol: currentSettings.currencySymbol,
        periodStart: weekPeriod(startDate).start,
        periodEnd: weekPeriod(startDate).end,
        createdAt: row.createdAt.toISOString(),
        lines,
        subtotals: buildSubtotals(lines),
      };
    });
  }
}

function toSettings(row: typeof settings.$inferSelect): WeekInvoiceSource['settings'] {
  return {
    displayName: row.displayName,
    weeklyTargetHours: row.weeklyTargetHours,
    currencySymbol: row.currencySymbol,
    invoicePrefix: row.invoicePrefix,
  };
}

function toEngineRecord(row: {
  id: number;
  date: string;
  hours: number;
  description: string;
  projectId: number;
  projectName: string;
  projectBillingHour: number | null;
  clientId: number | null;
  clientBillingHour: number | null;
}): EngineRecord {
  return {
    id: row.id,
    date: row.date,
    hours: row.hours,
    description: row.description,
    projectId: row.projectId,
    projectName: row.projectName,
    clientId: row.clientId,
    projectBillingHour: row.projectBillingHour,
    clientBillingHour: row.clientBillingHour,
  };
}