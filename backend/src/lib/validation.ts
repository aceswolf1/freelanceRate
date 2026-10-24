import { z } from 'zod';
import { isIsoDate } from './dates.js';

/**
 * Zod primitives shared by every module's schemas — one definition of "a
 * money amount", "a calendar date" and ":id" so the API rejects the same things
 * everywhere. Pure, no I/O.
 */

/** Positive integer path/query id: `:id` → 42. Rejects `0`, `-1`, `1.5`, `"abc"`. */
export const idSchema = z.coerce.number().int().positive();

export const idParamsSchema = z.object({ id: idSchema }).strict();

/** True when `value` carries no information below the 2nd decimal place. */
const hasAtMost2Decimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;

/** Money amount in major units: non-negative, max 2 decimals. */
export const moneyValueSchema = (options: { min?: number; max?: number } = {}) =>
  z
    .number({ invalid_type_error: 'Expected a number' })
    .finite()
    .min(options.min ?? 0, 'Must be 0 or greater')
    .max(options.max ?? 1_000_000, 'Value is too large')
    .refine(hasAtMost2Decimals, { message: 'At most 2 decimal places' });

/** Hours: > 0, <= 24 by default, max 2 decimals. */
export const hoursSchema = (max = 24) =>
  z
    .number({ invalid_type_error: 'Expected a number' })
    .finite()
    .positive('Must be greater than 0')
    .max(max, `Must be ${max} or less`)
    .refine(hasAtMost2Decimals, { message: 'At most 2 decimal places' });

/** A `YYYY-MM-DD` calendar date that really exists. */
export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: 'Must be a valid date in YYYY-MM-DD format' });

/** Optional-but-not-empty text. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Must not be empty')
    .max(max, `Must be ${max} characters or fewer`)
    .optional();

export const nullableText = (max: number) => optionalText(max).nullable();

export const requiredText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Must not be empty')
    .max(max, `Must be ${max} characters or fewer`);

/** Loose email check — deliberately permissive (RFC 5322 is not the goal). */
export const emailSchema = z
  .string()
  .trim()
  .email('Must be a valid email address')
  .max(320, 'Email is too long');