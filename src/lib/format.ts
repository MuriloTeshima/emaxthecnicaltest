export { formatEUR } from "@/domain/money";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatPercent(rate: number): string {
  return `${rate.toLocaleString("es-ES")} %`;
}
