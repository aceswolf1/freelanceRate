import { z } from 'zod';
import { moneyValueSchema, requiredText } from '../../lib/validation.js';

export const createPaymentPlatformSchema = z
  .object({
    company: requiredText(120),
    feePercent: moneyValueSchema({ max: 100 }).default(0),
    feeFlat: moneyValueSchema().default(0),
  })
  .strict();

export const updatePaymentPlatformSchema = createPaymentPlatformSchema.partial().strict();

export type CreatePaymentPlatformBody = z.infer<typeof createPaymentPlatformSchema>;
export type UpdatePaymentPlatformBody = z.infer<typeof updatePaymentPlatformSchema>;