import { z } from 'zod';
import { idSchema, moneyValueSchema, nullableText, requiredText } from '../../lib/validation.js';

export const createProjectSchema = z
  .object({
    name: requiredText(120),
    clientId: idSchema.nullable().optional(),
    description: nullableText(4_000),
    billingHour: moneyValueSchema({ min: 0.01, max: 10_000 }).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict();

export const updateProjectSchema = createProjectSchema.partial().strict();

export const listProjectsQuerySchema = z
  .object({
    /** `none` is sugar for "standalone projects only". */
    clientId: z.union([idSchema, z.literal('none')]).optional(),
    standalone: z.enum(['true', 'false']).optional(),
    archived: z.enum(['true', 'false', 'all']).optional(),
  })
  .strict();

export type CreateProjectBody = z.infer<typeof createProjectSchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;