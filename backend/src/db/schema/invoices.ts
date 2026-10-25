import { sql } from 'drizzle-orm';
import { date, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { hours, money } from './columns.js';
import { clients } from './clients.js';
import { weeks } from './weeks.js';

/**
 * One invoice per (week, client-bucket). `client_id IS NULL` is the
 * "No client" bucket holding every standalone project's hours.
 *
 * The unique index is split in two partial indexes because SQL treats NULLs as
 * distinct — a plain UNIQUE(week_id, client_id) would allow unlimited
 * "No client" invoices for the same week.
 *
 * Every client-facing field is a **snapshot**: rates, names and emails are
 * frozen at generation time so historic invoices never change.
 */
export const invoices = pgTable(
  'invoices',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    number: text('number').notNull(),
    weekId: integer('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),

    clientNameSnapshot: text('client_name_snapshot').notNull(),
    contactNameSnapshot: text('contact_name_snapshot'),
    contactEmailSnapshot: text('contact_email_snapshot').notNull().default(''),
    ccEmailSnapshot: text('cc_email_snapshot'),
    platformCompanySnapshot: text('platform_company_snapshot'),

    feePercent: money('fee_percent').notNull().default(0),
    feeFlat: money('fee_flat').notNull().default(0),
    totalHours: hours('total_hours').notNull().default(0),
    gross: money('gross').notNull().default(0),
    feeAmount: money('fee_amount').notNull().default(0),
    net: money('net').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    numberIdx: uniqueIndex('invoices_number_key').on(table.number),
    weekIdx: index('invoices_week_id_idx').on(table.weekId),
    weekClientUq: uniqueIndex('invoices_week_client_uq')
      .on(table.weekId, table.clientId)
      .where(sql`${table.clientId} is not null`),
    weekNoClientUq: uniqueIndex('invoices_week_no_client_uq')
      .on(table.weekId)
      .where(sql`${table.clientId} is null`),
  }),
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

/**
 * Immutable invoice line items — one per work record at generation time.
 * `record_id` / `project_id` may be null so deleting a record or project later
 * never destroys issued invoices.
 */
export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    invoiceId: integer('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    recordId: integer('record_id'),
    date: date('date', { mode: 'string' }).notNull(),
    projectId: integer('project_id'),
    projectNameSnapshot: text('project_name_snapshot').notNull(),
    description: text('description').notNull(),
    hours: hours('hours').notNull(),
    rate: money('rate').notNull(),
    lineTotal: money('line_total').notNull(),
  },
  (table) => ({
    invoiceIdx: index('invoice_lines_invoice_id_idx').on(table.invoiceId),
  }),
);

export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;