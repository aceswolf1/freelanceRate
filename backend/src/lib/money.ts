/**
 * Money helpers. All business arithmetic happens in **integer cents** so
 * floating-point drift can never accumulate; conversion to/from a decimal
 * number only happens at the API boundary.
 *
 * Pure module — no I/O.
 */

/** Decimal amount (e.g. `130.5`) → integer cents (`13050`). */
export function toCents(amount: number): number {
  // `Number()` first: a driver that hands back `numeric` as a string ("130.00")
  // would otherwise concatenate with EPSILON and produce NaN money.
  return Math.round((Number(amount) + Number.EPSILON) * 100);
}

/** Integer cents (`13050`) → decimal amount (`130.5`). */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Rounds a decimal amount to 2dp, protecting against binary float artefacts. */
export function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Rounds hours to 2dp for storage/display. */
export function roundHours(hours: number): number {
  return round2(hours);
}

/** Line total in cents: `hours * rate`, rounded once at the end. */
export function mulHoursRate(hours: number, rate: number): number {
  return Math.round(hours * toCents(rate));
}

/** `percentOf(227500, 1)` → `2275` cents ($22.75 of a $2,275.00 gross). */
export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export interface FeeBreakdown {
  grossCents: number;
  feeCents: number;
  netCents: number;
}

/**
 * Fee model (R3): `fee = round(gross * feePercent / 100) + feeFlat`,
 * `net = gross - fee`. The fee is always absorbed by the freelancer.
 */
export function withFees(grossCents: number, feePercent: number, feeFlat: number): FeeBreakdown {
  const feeCents = percentOf(grossCents, feePercent) + toCents(feeFlat);
  return { grossCents, feeCents, netCents: grossCents - feeCents };
}

/** `227500` → `"$2,275.00"`. Accepts cents by default; pass `inCents: false` for a decimal. */
export function formatMoney(
  amount: number,
  symbol = '$',
  options: { inCents?: boolean; fractionDigits?: number } = {},
): string {
  const { inCents = true, fractionDigits = 2 } = options;
  const value = inCents ? fromCents(amount) : amount;
  return `${symbol}${value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}