/**
 * MODEL layer — the single source of truth for the database shape.
 * Drizzle-kit reads this file; repositories import the re-exports below.
 */
export * from './columns.js';
export * from './payment-platforms.js';
export * from './clients.js';
export * from './projects.js';
export * from './weeks.js';
export * from './work-records.js';
export * from './invoices.js';
export * from './settings.js';