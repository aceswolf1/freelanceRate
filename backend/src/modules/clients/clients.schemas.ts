import { z } from 'zod';
import {
  emailSchema,
  idSchema,
  moneyValueSchema,
  nullableText,
  requiredText,
} from '../../lib/validation.js';

export const createClientSchema = z
  .object({
    name: requiredText(120),
    contactName: nullableText(120),
    contactEmail: emailSchema,
    ccEmail: emailSchema.nullable().optional(),
    billingHour: moneyValueSchema({ min: 0.01, max: 10_000 }),
    paymentPlatformId: idSchema.nullable().optional(),
    notes: nullableText(4_000),
  })
  .strict();

export const updateClientSchema = createClientSchema.partial().strict();

export type CreateClientBody = z.infer<typeof createClientSchema>;
export type UpdateClientBody = z.infer<typeof updateClientSchema>;