import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  clients,
  invoices,
  projects,
  weeks,
  workRecords,
  type NewWeek,
} from '../../db/schema/index.js';
import type { ClientSummary, ProjectSummary, RecordContextRow } from '../records/record-context.js';

export type WeekRow = typeof weeks.$inferSelect;

/** Data access only. */
export interface WeeksRepository {
  findById(id: number): Promise<WeekRow | null>;
  findByStartDate(startDate: string): Promise<WeekRow | null>;
  insert(values: NewWeek): Promise<WeekRow>;
  updateStatus(id: number, status: 'open' | 'closed', closedAt: Date | null): Promise<WeekRow | null>;
  getRecordContexts(weekId: number): Promise<RecordContextRow[]>;
  countInvoices(weekId: number): Promise<number>;
}

export class DrizzleWeeksRepository implements WeeksRepository {
  constructor(private readonly db: Database) {}

  async findById(id: number): Promise<WeekRow | null> {
    const [row] = await this.db.select().from(weeks).where(eq(weeks.id, id)).limit(1);
    return row ?? null;
  }

  async findByStartDate(startDate: string): Promise<WeekRow | null> {
    const [row] = await this.db.select().from(weeks).where(eq(weeks.startDate, startDate)).limit(1);
    return row ?? null;
  }

  async insert(values: NewWeek): Promise<WeekRow> {
    const [row] = await this.db.insert(weeks).values(values).returning();
    if (!row) throw new Error('Week insert returned no row');
    return row;
  }

  async updateStatus(
    id: number,
    status: 'open' | 'closed',
    closedAt: Date | null,
  ): Promise<WeekRow | null> {
    const rows = await this.db
      .update(weeks)
      .set({ status, closedAt })
      .where(eq(weeks.id, id))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Every record in the week with its project and client attached, in one
   * query — the week view then computes days and totals in memory.
   */
  async getRecordContexts(weekId: number): Promise<RecordContextRow[]> {
    const rows = await this.db
      .select({
        record: workRecords,
        projectId: projects.id,
        projectName: projects.name,
        projectClientId: projects.clientId,
        projectBillingHour: projects.billingHour,
        clientId: clients.id,
        // Selected as non-nullable columns: these are NOT NULL in `clients`, and
        // a NULL here always means the LEFT JOIN did not match (guarded below).
        clientName: sql<string>`${clients.name}`,
        clientContactEmail: sql<string>`${clients.contactEmail}`,
        clientCcEmail: sql<string | null>`${clients.ccEmail}`,
        // `::float8` matters: node-postgres returns `numeric` as a *string*, and
        // a bare `sql<number>` cast would only lie to the type checker.
        clientBillingHour: sql<number>`${clients.billingHour}::float8`,
      })
      .from(workRecords)
      .innerJoin(projects, eq(projects.id, workRecords.projectId))
      .leftJoin(clients, eq(clients.id, workRecords.clientId))
      .where(eq(workRecords.weekId, weekId))
      .orderBy(asc(workRecords.date), asc(workRecords.id));

    return rows.map((row) => {
      const project: ProjectSummary | null =
        row.projectId === null
          ? null
          : { id: row.projectId, name: row.projectName, clientId: row.projectClientId };
      const client: ClientSummary | null =
        row.clientId === null
          ? null
          : {
              id: row.clientId,
              name: row.clientName,
              contactEmail: row.clientContactEmail,
              ccEmail: row.clientCcEmail,
              billingHour: row.clientBillingHour,
            };
      return {
        record: row.record,
        project,
        projectBillingHour: row.projectBillingHour,
        client,
      };
    });
  }

  async countInvoices(weekId: number): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.weekId, weekId));
    return row?.value ?? 0;
  }
}