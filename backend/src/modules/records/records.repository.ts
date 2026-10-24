import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  clients,
  projects,
  workRecords,
  type NewWorkRecord,
  type WorkRecord,
} from '../../db/schema/index.js';
import type { RecordContextRow } from './record-context.js';

/** Data access only. */
export interface RecordsRepository {
  findContextById(id: number): Promise<RecordContextRow | null>;
  insert(values: NewWorkRecord): Promise<WorkRecord | null>;
  update(id: number, patch: Partial<NewWorkRecord>): Promise<WorkRecord | null>;
  remove(id: number): Promise<boolean>;
}

export class DrizzleRecordsRepository implements RecordsRepository {
  constructor(private readonly db: Database) {}

  async findContextById(id: number): Promise<RecordContextRow | null> {
    const [row] = await this.db
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
      .where(eq(workRecords.id, id))
      .limit(1);

    if (!row) return null;
    return {
      record: row.record,
      project:
        row.projectId === null
          ? null
          : { id: row.projectId, name: row.projectName, clientId: row.projectClientId },
      projectBillingHour: row.projectBillingHour,
      client:
        row.clientId === null
          ? null
          : {
              id: row.clientId,
              name: row.clientName,
              contactEmail: row.clientContactEmail,
              ccEmail: row.clientCcEmail,
              billingHour: row.clientBillingHour,
            },
    };
  }

  async insert(values: NewWorkRecord): Promise<WorkRecord | null> {
    const [row] = await this.db.insert(workRecords).values(values).returning();
    return row ?? null;
  }

  async update(id: number, patch: Partial<NewWorkRecord>): Promise<WorkRecord | null> {
    const rows = await this.db
      .update(workRecords)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(workRecords.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(workRecords)
      .where(eq(workRecords.id, id))
      .returning({ id: workRecords.id });
    return rows.length > 0;
  }
}