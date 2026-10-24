import { z } from 'zod';
import { hoursSchema, requiredText } from '../../lib/validation.js';

export const updateSettingsSchema = z
  .object({
    displayName: requiredText(120),
    weeklyTargetHours: hoursSchema(168),
    currencySymbol: requiredText(5),
    invoicePrefix: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9-]+$/, 'May only contain letters, digits and dashes'),
  })
  .strict()
  .partial();

export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;