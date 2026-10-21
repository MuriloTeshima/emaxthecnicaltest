/**
 * Money is always handled as integer cents to avoid floating point drift.
 * Rounding is half-up (away from zero), which matches how Spanish invoices
 * are usually rounded.
 */

export type Cents = number;

export function roundHalfUp(value: number): number {
  // Number.EPSILON nudges values like 1.005 that are stored as 1.00499999…
  return Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON * Math.abs(value));
}

/** Percentage of an amount in cents, e.g. percentOf(100000, 21) === 21000. */
export function percentOf(cents: Cents, rate: number): Cents {
  return roundHalfUp((cents * rate) / 100);
}

/** Parses "1.210,50", "1210.50" or 1210.5 into cents. Returns null when invalid. */
export function parseEuros(input: string | number): Cents | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? roundHalfUp(input * 100) : null;
  }
  let s = input.trim().replace(/[€\s]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma === -1 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.060" or "12.500.000": dots can only be thousands separators here
    s = s.replace(/\./g, "");
  } else if (lastComma > lastDot) {
    // Spanish format: dots are thousands separators, comma is decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return roundHalfUp(Number(s) * 100);
}

export function centsToEuros(cents: Cents): number {
  return cents / 100;
}

const eurFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  // es-ES skips the thousands separator for 4-digit numbers by default
  useGrouping: "always",
});

export function formatEUR(cents: Cents): string {
  return eurFormatter.format(cents / 100);
}

export function sum(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0);
}
