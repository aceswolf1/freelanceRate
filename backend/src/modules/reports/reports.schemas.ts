/**
 * Zod schemas for the earnings report's query string (contract §4.8).
 *
 * `from` / `to` are optional and default to the earliest / latest record date;
 * `groupBy` defaults to `project`.
 */
import { z } from 'zod';
import { isIsoDate } from '../../lib/dates.js';

const isoDate = z
  .string()
  .refine(isIsoDate, { message: 'must be a valid YYYY-MM-DD calendar date' });

export const earningsQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  groupBy: z.enum(['project', 'client']).default('project'),
});

export type EarningsQuery = z.infer<typeof earningsQuerySchema>;