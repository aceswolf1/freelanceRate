import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { money } from './columns.js';

/**
 * Payment platforms (e.g. Payoneer, Wise, Domestic Wire).
 * Fee model: `fee = gross * fee_percent / 100 + fee_flat`, always absorbed by the
 * freelancer (net = gross − fee).
 */
export const paymentPlatforms = pgTable(
  'payment_platforms',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    company: text('company').notNull(),
    feePercent: money('fee_percent').notNull().default(0),
    feeFlat: money('fee_flat').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index('payment_platforms_company_idx').on(table.company),
  }),
);

export type PaymentPlatform = typeof paymentPlatforms.$inferSelect;
export type NewPaymentPlatform = typeof paymentPlatforms.$inferInsert;