import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  hoursSchema,
  idSchema,
  isoDateSchema,
  moneyValueSchema,
  nullableText,
  requiredText,
} from './validation.js';

describe('idSchema', () => {
  it('coerces positive integers from strings', () => {
    expect(idSchema.parse('42')).toBe(42);
    expect(idSchema.parse(7)).toBe(7);
  });

  it('rejects zero, negatives, fractions and non-numbers', () => {
    expect(idSchema.safeParse(0).success).toBe(false);
    expect(idSchema.safeParse(-1).success).toBe(false);
    expect(idSchema.safeParse(1.5).success).toBe(false);
    expect(idSchema.safeParse('abc').success).toBe(false);
  });
});

describe('moneyValueSchema', () => {
  it('accepts 0–2 decimals', () => {
    expect(moneyValueSchema().parse(0)).toBe(0);
    expect(moneyValueSchema().parse(130.5)).toBe(130.5);
    expect(moneyValueSchema().parse(15)).toBe(15);
  });

  it('rejects more than 2 decimals and negatives', () => {
    expect(moneyValueSchema().safeParse(1.005).success).toBe(false);
    expect(moneyValueSchema().safeParse(-0.01).success).toBe(false);
  });

  it('honours a custom minimum', () => {
    expect(moneyValueSchema({ min: 0.01 }).safeParse(0).success).toBe(false);
  });
});

describe('hoursSchema', () => {
  it('accepts 0 < hours <= max with 2 decimals', () => {
    expect(hoursSchema().parse(24)).toBe(24);
    expect(hoursSchema().parse(7.5)).toBe(7.5);
  });

  it('rejects 0, over-24 and >2 decimals', () => {
    expect(hoursSchema().safeParse(0).success).toBe(false);
    expect(hoursSchema().safeParse(24.5).success).toBe(false);
    expect(hoursSchema().safeParse(7.555).success).toBe(false);
  });
});

describe('isoDateSchema', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    expect(isoDateSchema.parse('2026-10-19')).toBe('2026-10-19');
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(isoDateSchema.safeParse('19-10-2026').success).toBe(false);
  });
});

describe('text schemas', () => {
  it('trims and enforces non-empty', () => {
    expect(requiredText(10).parse('  Acme  ')).toBe('Acme');
    expect(requiredText(10).safeParse('   ').success).toBe(false);
    expect(requiredText(2).safeParse('Acme').success).toBe(false);
  });

  it('treats null and undefined as "not provided" for nullable text', () => {
    expect(nullableText(10).parse(null)).toBeNull();
    expect(nullableText(10).parse(undefined)).toBeUndefined();
  });
});

describe('emailSchema', () => {
  it('accepts normal addresses and rejects junk', () => {
    expect(emailSchema.parse('billing@acme.example')).toBe('billing@acme.example');
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});