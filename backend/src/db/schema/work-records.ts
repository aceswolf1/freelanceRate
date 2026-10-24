import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { hours } from './columns.js';
import { clients } from './clients.js';
import { projects } from './projects.js';
import { weeks } from './weeks.js';

/**
 * A logged block of work. `client_id` is **denormalized at write time** from the
 * project's client (null for standalone projects) so invoicing can bucket
 * records by client without re-joining projects on every read.
 */
export const workRecords = pgTable(
  'work_records',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    weekId: integer('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    hours: hours('hours').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    weekIdx: index('work_records_week_id_idx').on(table.weekId),
    projectIdx: index('work_records_project_id_idx').on(table.projectId),
    dateIdx: index('work_records_date_idx').on(table.date),
    hours_check: check('work_records_hours_check', sql`${table.hours} > 0 and ${table.hours} <= 24`),
  }),
);

export type WorkRecord = typeof workRecords.$inferSelect;
export type NewWorkRecord = typeof workRecords.$inferInsert;