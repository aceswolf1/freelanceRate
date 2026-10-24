import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  clients,
  projects,
  workRecords,
  type NewProject,
} from '../../db/schema/index.js';

export interface ClientRef {
  id: number;
  name: string;
  contactEmail: string;
  ccEmail: string | null;
  billingHour: number;
}

/** A project plus its client summary and record count. */
export interface ProjectRow {
  id: number;
  name: string;
  clientId: number | null;
  description: string | null;
  billingHour: number | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  client: ClientRef | null;
  recordCount: number;
}

export interface ProjectQuery {
  clientId?: number;
  standalone?: boolean;
  archived?: boolean;
}

/** Data access only. */
export interface ProjectsRepository {
  list(filters: ProjectQuery): Promise<ProjectRow[]>;
  findById(id: number): Promise<ProjectRow | null>;
  findByName(name: string, clientId: number | null): Promise<ProjectRow | null>;
  findClient(id: number): Promise<ClientRef | null>;
  countRecords(projectId: number): Promise<number>;
  insert(values: NewProject): Promise<ProjectRow>;
  update(id: number, patch: Partial<NewProject>): Promise<ProjectRow | null>;
  remove(id: number): Promise<boolean>;
}

export class DrizzleProjectsRepository implements ProjectsRepository {
  constructor(private readonly db: Database) {}

  async list(filters: ProjectQuery): Promise<ProjectRow[]> {
    const conditions = [
      filters.clientId === undefined ? undefined : eq(projects.clientId, filters.clientId),
      filters.standalone === undefined ? undefined : filters.standalone ? isNull(projects.clientId) : sql`${projects.clientId} is not null`,
      filters.archived === undefined ? undefined : eq(projects.archived, filters.archived),
    ].filter((condition) => condition !== undefined);

    const rows = await this.db
      .select()
      .from(projects)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(projects.name));
    return this.enrich(rows);
  }

  async findById(id: number): Promise<ProjectRow | null> {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!row) return null;
    const [enriched] = await this.enrich([row]);
    return enriched ?? null;
  }

  async findByName(name: string, clientId: number | null): Promise<ProjectRow | null> {
    const [row] = await this.db
      .select()
      .from(projects)
      .where(
        and(
          sql`lower(${projects.name}) = lower(${name})`,
          clientId === null ? isNull(projects.clientId) : eq(projects.clientId, clientId),
        ),
      )
      .limit(1);
    if (!row) return null;
    const [enriched] = await this.enrich([row]);
    return enriched ?? null;
  }

  async findClient(id: number): Promise<ClientRef | null> {
    const [row] = await this.db
      .select({
        id: clients.id,
        name: clients.name,
        contactEmail: clients.contactEmail,
        ccEmail: clients.ccEmail,
        billingHour: clients.billingHour,
      })
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    return row ?? null;
  }

  async countRecords(projectId: number): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(workRecords)
      .where(eq(workRecords.projectId, projectId));
    return row?.value ?? 0;
  }

  async insert(values: NewProject): Promise<ProjectRow> {
    const [created] = await this.db.insert(projects).values(values).returning();
    if (!created) throw new Error('Project insert returned no row');
    const enriched = await this.findById(created.id);
    if (!enriched) throw new Error(`Project ${created.id} vanished after insert`);
    return enriched;
  }

  async update(id: number, patch: Partial<NewProject>): Promise<ProjectRow | null> {
    const rows = await this.db
      .update(projects)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    return rows[0] ? this.findById(id) : null;
  }

  async remove(id: number): Promise<boolean> {
    const rows = await this.db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
    return rows.length > 0;
  }

  /** Attaches the client summary and record count in two extra queries. */
  private async enrich(rows: (typeof projects.$inferSelect)[]): Promise<ProjectRow[]> {
    if (rows.length === 0) return [];
    const clientIds = [
      ...new Set(rows.map((row) => row.clientId).filter((id): id is number => id !== null)),
    ];
    const ids = rows.map((row) => row.id);

    const [clientRefs, recordCounts] = await Promise.all([
      clientIds.length === 0
        ? Promise.resolve([] as ClientRef[])
        : this.db
            .select({
              id: clients.id,
              name: clients.name,
              contactEmail: clients.contactEmail,
              ccEmail: clients.ccEmail,
              billingHour: clients.billingHour,
            })
            .from(clients)
            .where(inArray(clients.id, clientIds)),
      this.db
        .select({ projectId: workRecords.projectId, value: count() })
        .from(workRecords)
        .where(inArray(workRecords.projectId, ids))
        .groupBy(workRecords.projectId),
    ]);

    const clientById = new Map(clientRefs.map((client) => [client.id, client]));
    const recordsByProject = new Map(recordCounts.map((entry) => [entry.projectId, entry.value]));

    return rows.map((row) => ({
      ...row,
      client: row.clientId === null ? null : clientById.get(row.clientId) ?? null,
      recordCount: recordsByProject.get(row.id) ?? 0,
    }));
  }
}