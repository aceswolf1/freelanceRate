import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { settings, type NewSettings } from '../../db/schema/index.js';

export type SettingsRow = typeof settings.$inferSelect;

/** Data access only — `settings` is a singleton pinned to id = 1. */
export interface SettingsRepository {
  ensure(): Promise<SettingsRow>;
  update(patch: Partial<NewSettings>): Promise<SettingsRow>;
}

export class DrizzleSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Database) {}

  /** Returns the singleton row, creating it with defaults on first access. */
  async ensure(): Promise<SettingsRow> {
    const [row] = await this.db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    if (row) return row;
    return this.insertDefault();
  }

  async update(patch: Partial<NewSettings>): Promise<SettingsRow> {
    const [row] = await this.db
      .update(settings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(settings.id, 1))
      .returning();
    if (row) return row;

    // The singleton does not exist yet (fresh database, or the row was removed).
    // Create it **with the patch applied** — inserting defaults here would
    // silently discard the update the caller just made.
    const [created] = await this.db
      .insert(settings)
      .values({ id: 1, ...patch })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    // Another writer inserted the singleton concurrently — fall back to it.
    const [existing] = await this.db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    if (!existing) throw new Error('Settings row could not be created');
    return existing;
  }

  private async insertDefault(): Promise<SettingsRow> {
    await this.db
      .insert(settings)
      .values({ id: 1 })
      .onConflictDoNothing();
    const [row] = await this.db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    if (!row) throw new Error('Settings row could not be created');
    return row;
  }
}