import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import {
  paymentPlatforms,
  type NewPaymentPlatform,
  type PaymentPlatform,
} from '../../db/schema/index.js';

/** Data access only — no business rules live here. */
export interface PaymentPlatformRepository {
  list(): Promise<PaymentPlatform[]>;
  findById(id: number): Promise<PaymentPlatform | null>;
  findByCompany(company: string): Promise<PaymentPlatform | null>;
  insert(values: NewPaymentPlatform): Promise<PaymentPlatform>;
  update(id: number, patch: Partial<NewPaymentPlatform>): Promise<PaymentPlatform | null>;
  remove(id: number): Promise<boolean>;
}

export class DrizzlePaymentPlatformRepository implements PaymentPlatformRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<PaymentPlatform[]> {
    return this.db.select().from(paymentPlatforms).orderBy(asc(paymentPlatforms.company));
  }

  async findById(id: number): Promise<PaymentPlatform | null> {
    const [row] = await this.db
      .select()
      .from(paymentPlatforms)
      .where(eq(paymentPlatforms.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByCompany(company: string): Promise<PaymentPlatform | null> {
    const [row] = await this.db
      .select()
      .from(paymentPlatforms)
      .where(sql`lower(${paymentPlatforms.company}) = lower(${company})`)
      .limit(1);
    return row ?? null;
  }

  async insert(values: NewPaymentPlatform): Promise<PaymentPlatform> {
    const [created] = await this.db.insert(paymentPlatforms).values(values).returning();
    if (!created) throw new Error('Payment platform insert returned no row');
    return created;
  }

  async update(id: number, patch: Partial<NewPaymentPlatform>): Promise<PaymentPlatform | null> {
    const rows = await this.db
      .update(paymentPlatforms)
      .set(patch)
      .where(eq(paymentPlatforms.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(paymentPlatforms)
      .where(eq(paymentPlatforms.id, id))
      .returning({ id: paymentPlatforms.id });
    return rows.length > 0;
  }
}