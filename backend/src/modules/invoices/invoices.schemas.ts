/**
 * Zod schemas for the invoice endpoints' inputs.
 *
 * Only path params exist here today (invoice generation takes no body); every
 * other input is validated by the engine or rejected by the service with a
 * typed `AppError`. Unknown keys are stripped rather than rejected because
 * Express params carry only what the route declared.
 */
import { z } from 'zod';

/** Positive integer primary key, coerced from the string Express always provides. */
export const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'id must be a positive integer' })
    .int()
    .positive(),
});

export const weekParamSchema = z.object({
  weekId: z.coerce
    .number({ invalid_type_error: 'weekId must be a positive integer' })
    .int()
    .positive(),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type WeekParam = z.infer<typeof weekParamSchema>;