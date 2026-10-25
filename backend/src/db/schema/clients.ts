import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { money } from './columns.js';
import { paymentPlatforms } from './payment-platforms.js';

/** Clients bill at `billing_hour` unless a project overrides it. */
export const clients = pgTable(
  'clients',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    contactEmail: text('contact_email').notNull(),
    ccEmail: text('cc_email'),
    billingHour: money('billing_hour').notNull(),
    paymentPlatformId: integer('payment_platform_id').references(() => paymentPlatforms.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index('clients_name_idx').on(table.name),
    platformIdx: index('clients_payment_platform_id_idx').on(table.paymentPlatformId),
  }),
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;