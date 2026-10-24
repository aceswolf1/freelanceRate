import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { money } from './columns.js';
import { clients } from './clients.js';

/**
 * Projects. `client_id IS NULL` means **standalone** (invoiced into the
 * "No client" bucket). A standalone project must define its own `billing_hour`;
 * a client project inherits the client's rate when `billing_hour` is null.
 */
export const projects = pgTable(
  'projects',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    clientId: integer('client_id').references(() => clients.id, { onDelete: 'restrict' }),
    description: text('description'),
    billingHour: money('billing_hour'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index('projects_client_id_idx').on(table.clientId),
    client_or_rate_check: check(
      'projects_client_or_rate_check',
      sql`${table.clientId} is not null or ${table.billingHour} is not null`,
    ),
  }),
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;