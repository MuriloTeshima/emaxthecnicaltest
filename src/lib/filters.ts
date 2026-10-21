import { type Period, formatPeriod, parsePeriodParam, periodToParam, previousPeriods, quarterOf, quarterRange, todayUTC } from "@/domain/period";

type SearchParams = Record<string, string | string[] | undefined>;

export function param(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Last eight quarters, for the "Periodo" filter. */
export function periodOptions() {
  return previousPeriods(quarterOf(todayUTC()), 8).map((p) => ({ value: periodToParam(p), label: formatPeriod(p) }));
}

/** Date range of the selected quarter, or undefined when no period is chosen. */
export function periodRange(value: string): { gte: Date; lt: Date } | undefined {
  if (!value) return undefined;
  const fallback: Period = { year: 0, quarter: 1 };
  const period = parsePeriodParam(value, fallback);
  if (period.year === 0) return undefined;
  const { start, end } = quarterRange(period);
  return { gte: start, lt: end };
}
