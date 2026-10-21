/**
 * Tax periods are calendar quarters (1T–4T). Dates are handled as UTC
 * calendar days so a "2026-03-31" invoice never drifts into Q2 because of
 * the server time zone.
 */

export type Quarter = 1 | 2 | 3 | 4;
export interface Period {
  year: number;
  quarter: Quarter;
}

export function quarterOf(date: Date): Period {
  return {
    year: date.getUTCFullYear(),
    quarter: (Math.floor(date.getUTCMonth() / 3) + 1) as Quarter,
  };
}

/** [start, end) range of a quarter in UTC. */
export function quarterRange({ year, quarter }: Period): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 1)),
  };
}

export function isInPeriod(date: Date, period: Period): boolean {
  const { start, end } = quarterRange(period);
  return date >= start && date < end;
}

export function formatPeriod({ year, quarter }: Period): string {
  return `${quarter}T ${year}`;
}

/** "2026-4" ⇄ Period, used in URLs. */
export function periodToParam({ year, quarter }: Period): string {
  return `${year}-${quarter}`;
}

export function parsePeriodParam(param: string | undefined, fallback: Period): Period {
  const match = param?.match(/^(\d{4})-([1-4])$/);
  if (!match) return fallback;
  return { year: Number(match[1]), quarter: Number(match[2]) as Quarter };
}

export function previousPeriods(from: Period, count: number): Period[] {
  const result: Period[] = [];
  let { year, quarter } = from;
  for (let i = 0; i < count; i++) {
    result.push({ year, quarter });
    quarter = (quarter === 1 ? 4 : quarter - 1) as Quarter;
    if (quarter === 4) year -= 1;
  }
  return result;
}

/** Parses "YYYY-MM-DD" as a UTC calendar date. */
export function parseISODate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  // Date.UTC rolls impossible dates over (31 Feb → 3 Mar); reject them instead.
  return toISODate(date) === value ? date : null;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
