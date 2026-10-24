import { z } from 'zod';
import { hoursSchema, idSchema, isoDateSchema, requiredText } from '../../lib/validation.js';

export const createRecordSchema = z
  .object({
    projectId: idSchema,
    description: requiredText(500),
    hours: hoursSchema(24),
    date: isoDateSchema,
  })
  .strict();

export const updateRecordSchema = createRecordSchema.partial().strict();

export type CreateRecordBody = z.infer<typeof createRecordSchema>;
export type UpdateRecordBody = z.infer<typeof updateRecordSchema>;

/** The create route is mounted at `/weeks/:weekId/records`. */
export const weekIdParamsSchema = z.object({ weekId: idSchema }).strict();