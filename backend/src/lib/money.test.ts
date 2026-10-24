import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  fromCents,
  mulHoursRate,
  percentOf,
  round2,
  roundHours,
  sumCents,
  toCents,
  withFees,
} from './money.js';

describe('toCents / fromCents', () => {
  it('converts decimals to integer cents', () => {
    expect(toCents(130)).toBe(13_000);
    expect(toCents(130.5)).toBe(13_050);
    expect(toCents(0.01)).toBe(1);
  });

  it('round-trips without drift', () => {
    expect(fromCents(13_050)).toBe(130.5);
    expect(fromCents(toCents(99.99))).toBe(99.99);
  });

  it('rounds half-up at the cent', () => {
    expect(toCents(0.005)).toBe(1);
    expect(toCents(1.004)).toBe(100);
  });

  it('coerces numeric strings instead of producing NaN', () => {
    // node-postgres hands `numeric` back as a string; money math must survive it.
    expect(toCents('130.00' as unknown as number)).toBe(13_000);
    expect(mulHoursRate(3.5, '130.00' as unknown as number)).toBe(45_500);
    expect(fromCents(toCents('0.07' as unknown as number))).toBe(0.07);
  });
});

describe('round2 / roundHours', () => {
  it('kills binary float artefacts', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });

  it('rounds hours to 2dp', () => {
    expect(roundHours(7.555)).toBe(7.56);
    expect(roundHours(8)).toBe(8);
  });
});

describe('mulHoursRate', () => {
  it('computes a line total in cents', () => {
    expect(mulHoursRate(7.5, 130)).toBe(97_500); // $975.00
    expect(mulHoursRate(2, 115)).toBe(23_000); // $230.00
    expect(mulHoursRate(0.25, 95)).toBe(2_375); // $23.75
  });

  it('rounds once, at the end', () => {
    // 3.3 * 33.33 = 109.989 → 10999 cents
    expect(mulHoursRate(3.3, 33.33)).toBe(10_999);
  });
});

describe('percentOf / withFees', () => {
  it('computes a percentage of a cent amount', () => {
    expect(percentOf(227_500, 1)).toBe(2_275); // 1% of $2,275.00
    expect(percentOf(227_500, 0.5)).toBe(1_138); // 0.5% → $11.375 → $11.38
  });

  it('adds percent + flat fee and subtracts from gross', () => {
    expect(withFees(227_500, 1, 15)).toEqual({
      grossCents: 227_500,
      feeCents: 3_775, // 2.275 + 15.00
      netCents: 223_725, // $2,237.25
    });
  });

  it('handles a flat-fee-only platform', () => {
    expect(withFees(50_000, 0, 15)).toEqual({
      grossCents: 50_000,
      feeCents: 1_500,
      netCents: 48_500,
    });
  });

  it('returns zero fee when the platform is free', () => {
    expect(withFees(12_345, 0, 0)).toEqual({
      grossCents: 12_345,
      feeCents: 0,
      netCents: 12_345,
    });
  });
});

describe('sumCents', () => {
  it('sums an immutable total', () => {
    expect(sumCents([100, 250, 650])).toBe(1_000);
    expect(sumCents([])).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formats cents with grouping', () => {
    expect(formatMoney(227_500)).toBe('$2,275.00');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('accepts a decimal amount and a custom symbol', () => {
    expect(formatMoney(130.5, '€', { inCents: false })).toBe('€130.50');
  });
});