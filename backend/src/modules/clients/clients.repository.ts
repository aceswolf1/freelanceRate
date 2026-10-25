import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  clients,
  paymentPlatforms,
  projects,
  workRecords,
  type NewClient,
} from '../../db/schema/index.js';

export type PaymentPlatformRef = {
  id: number;
  company: string;
  feePercent: number;
  feeFlat: number;
  createdAt: Date;
};

/** A client plus everything its DTO carries (platform + aggregates). */
export interface ClientRow {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string;
  ccEmail: string | null;
  billingHour: number;
  paymentPlatformId: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  platform: PaymentPlatformRef | null;
  projectCount: number;
  totalHours: number;
  totalGross: number;
}

/** Data access only — no business rules. */
export interface ClientsRepository {
  list(): Promise<ClientRow[]>;
  findById(id: number): Promise<ClientRow | null>;
  findByName(name: string): Promise<ClientRow | null>;
  countProjects(clientId: number): Promise<number>;
  countRecords(clientId: number): Promise<number>;
  findPaymentPlatformById(id: number): Promise<PaymentPlatformRef | null>;
  insert(values: NewClient): Promise<ClientRow>;
  update(id: number, patch: Partial<NewClient>): Promise<ClientRow | null>;
  remove(id: number): Promise<boolean>;
}

interface ClientStats {
  projectCount: number;
  totalHours: number;
  totalGross: number;
}

export class DrizzleClientsRepository implements ClientsRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<ClientRow[]> {
    const rows = await this.db.select().from(clients).orderBy(sql`lower(${clients.name}) asc`);
    return this.enrich(rows);
  }

  async findById(id: number): Promise<ClientRow | null> {
    const [row] = await this.db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!row) return null;
    const [enriched] = await this.enrich([row]);
    return enriched ?? null;
  }

  async findByName(name: string): Promise<ClientRow | null> {
    const [row] = await this.db
      .select()
      .from(clients)
      .where(sql`lower(${clients.name}) = lower(${name})`)
      .limit(1);
    if (!row) return null;
    const [enriched] = await this.enrich([row]);
    return enriched ?? null;
  }

  async countProjects(clientId: number): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.clientId, clientId));
    return row?.value ?? 0;
  }

  async countRecords(clientId: number): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(workRecords)
      .where(eq(workRecords.clientId, clientId));
    return row?.value ?? 0;
  }

  async findPaymentPlatformById(id: number): Promise<PaymentPlatformRef | null> {
    const [row] = await this.db
      .select({
        id: paymentPlatforms.id,
        company: paymentPlatforms.company,
        feePercent: paymentPlatforms.feePercent,
        feeFlat: paymentPlatforms.feeFlat,
        createdAt: paymentPlatforms.createdAt,
      })
      .from(paymentPlatforms)
      .where(eq(paymentPlatforms.id, id))
      .limit(1);
    return row ?? null;
  }

  async insert(values: NewClient): Promise<ClientRow> {
    const [created] = await this.db.insert(clients).values(values).returning();
    if (!created) throw new Error('Client insert returned no row');
    const enriched = await this.findById(created.id);
    if (!enriched) throw new Error(`Client ${created.id} vanished after insert`);
    return enriched;
  }

  async update(id: number, patch: Partial<NewClient>): Promise<ClientRow | null> {
    const rows = await this.db
      .update(clients)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning({ id: clients.id });
    return rows[0] ? this.findById(id) : null;
  }

  async remove(id: number): Promise<boolean> {
    const rows = await this.db.delete(clients).where(eq(clients.id, id)).returning({ id: clients.id });
    return rows.length > 0;
  }

  /**
   * Attaches the payment platform plus project count, lifetime hours and
   * lifetime gross. Three queries total regardless of how many clients are
   * passed in, so listing never degrades into an N+1 walk.
   */
  private async enrich(rows: (typeof clients.$inferSelect)[]): Promise<ClientRow[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    // The platform lookup must use the clients' **platform** ids — using the
    // client ids here silently resolves the wrong (or no) platform.
    const platformIds = [
      ...new Set(
        rows
          .map((row) => row.paymentPlatformId)
          .filter((id): id is number => id !== null && id !== undefined),
      ),
    ];
    const [platformRefs, stats] = await Promise.all([
      platformIds.length === 0
        ? Promise.resolve([])
        : this.db
            .select({
              id: paymentPlatforms.id,
              company: paymentPlatforms.company,
              feePercent: paymentPlatforms.feePercent,
              feeFlat: paymentPlatforms.feeFlat,
              createdAt: paymentPlatforms.createdAt,
            })
            .from(paymentPlatforms)
            .where(inArray(paymentPlatforms.id, platformIds)),
      this.statsFor(ids),
    ]);

    const platformById = new Map(platformRefs.map((platform) => [platform.id, platform]));
    return rows.map((row) => ({
      ...row,
      platform: row.paymentPlatformId === null ? null : platformById.get(row.paymentPlatformId) ?? null,
      ...(stats.get(row.id) ?? { projectCount: 0, totalHours: 0, totalGross: 0 }),
    }));
  }

  private async statsFor(ids: number[]): Promise<Map<number, ClientStats>> {
    const [projectCounts, lifetime] = await Promise.all([
      this.db
        .select({ clientId: projects.clientId, value: count() })
        .from(projects)
        .where(and(inArray(projects.clientId, ids), eq(projects.archived, false)))
        .groupBy(projects.clientId),
      this.db
        .select({
          clientId: workRecords.clientId,
          hours: sql<number>`coalesce(sum(${workRecords.hours}), 0)::float8`,
          // Effective rate per record: the project's override, else the client's rate.
          gross: sql<number>`coalesce(sum(${workRecords.hours} * coalesce(${projects.billingHour}, ${clients.billingHour})), 0)::float8`,
        })
        .from(workRecords)
        .innerJoin(projects, eq(projects.id, workRecords.projectId))
        .innerJoin(clients, eq(clients.id, workRecords.clientId))
        .where(inArray(workRecords.clientId, ids))
        .groupBy(workRecords.clientId),
    ]);

    const zeros = new Map<number, ClientStats>(
      ids.map((id) => [id, { projectCount: 0, totalHours: 0, totalGross: 0 }]),
    );
    const withCounts = new Map([...zeros].map(([id, stats]) => [id, { ...stats }]));
    for (const entry of projectCounts) {
      if (entry.clientId === null) continue;
      const current = withCounts.get(entry.clientId);
      if (current) withCounts.set(entry.clientId, { ...current, projectCount: entry.value });
    }
    for (const entry of lifetime) {
      if (entry.clientId === null) continue;
      const current = withCounts.get(entry.clientId) ?? { projectCount: 0, totalHours: 0, totalGross: 0 };
      withCounts.set(entry.clientId, {
        ...current,
        totalHours: entry.hours,
        totalGross: entry.gross,
      });
    }
    return withCounts;
  }
}