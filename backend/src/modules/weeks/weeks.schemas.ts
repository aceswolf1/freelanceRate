import { z } from 'zod';
import { idParamsSchema, isoDateSchema } from '../../lib/validation.js';

export const weekIdParamsSchema = idParamsSchema;
export const weekDateParamsSchema = z.object({ date: isoDateSchema }).strict();