import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { hours } from './columns.js';

/**
 * Singleton settings row — `id` is pinned to 1 by the application
 * (`ensureSettings` upserts id = 1); there is never a second row.
 */
export const settings = pgTable('settings', {
  id: integer('id').primaryKey(),
  displayName: text('display_name').notNull().default('Alex Morgan'),
  weeklyTargetHours: hours('weekly_target_hours').notNull().default(40),
  currencySymbol: text('currency_symbol').notNull().default('$'),
  invoicePrefix: text('invoice_prefix').notNull().default('INV'),
  /** Copied-email content toggles (Settings → Email content); all off by default. */
  emailShowRate: boolean('email_show_rate').notNull().default(false),
  emailShowGross: boolean('email_show_gross').notNull().default(false),
  emailShowFee: boolean('email_show_fee').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;