import { date, integer, pgEnum, pgTable, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const weekStatus = pgEnum('week_status', ['open', 'closed']);
export type WeekStatus = (typeof weekStatus.enumValues)[number];

/**
 * A week is stored by its Monday `start_date` (unique, `date` column kept as a
 * `YYYY-MM-DD` string end-to-end). The Sunday end date is derived
 * (`start_date + 6`) so the Mon–Sun window can never drift.
 */
export const weeks = pgTable(
  'weeks',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    status: weekStatus('status').notNull().default('open'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    startDateIdx: uniqueIndex('weeks_start_date_key').on(table.startDate),
  }),
);

export type Week = typeof weeks.$inferSelect;
export type NewWeek = typeof weeks.$inferInsert;