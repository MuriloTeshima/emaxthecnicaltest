import { type Cents, percentOf, roundHalfUp, sum } from "./money";
import { type OperationType, isIntraEu } from "./rates";

export interface InvoiceLineInput {
  description: string;
  quantity: number; // up to 3 decimals
  unitPriceCents: Cents;
  vatRate: number;
}

export interface VatBreakdown {
  vatRate: number;
  baseCents: Cents;
  vatCents: Cents;
}

export interface InvoiceTotals {
  baseCents: Cents;
  vatCents: Cents;
  totalCents: Cents;
  breakdown: VatBreakdown[];
}

export function lineBaseCents(line: Pick<InvoiceLineInput, "quantity" | "unitPriceCents">): Cents {
  // Scale quantity to an integer first so 0.1 * 3 style floats don't leak in.
  const qtyMilli = Math.round(line.quantity * 1000);
  return roundHalfUp((qtyMilli * line.unitPriceCents) / 1000);
}

/**
 * VAT is computed per rate on the summed base of that rate, as on a real
 * invoice (not per line), so the breakdown matches what gets declared.
 * Intra-EU operations are invoiced without VAT (reverse charge).
 */
export function invoiceTotals(
  lines: InvoiceLineInput[],
  operationType: OperationType = "DOMESTIC",
): InvoiceTotals {
  const byRate = new Map<number, Cents>();
  for (const line of lines) {
    const rate = isIntraEu(operationType) ? 0 : line.vatRate;
    byRate.set(rate, (byRate.get(rate) ?? 0) + lineBaseCents(line));
  }

  const breakdown: VatBreakdown[] = [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([vatRate, baseCents]) => ({ vatRate, baseCents, vatCents: percentOf(baseCents, vatRate) }));

  const baseCents = sum(breakdown.map((b) => b.baseCents));
  const vatCents = sum(breakdown.map((b) => b.vatCents));
  return { baseCents, vatCents, totalCents: baseCents + vatCents, breakdown };
}

export type InvoiceDisplayStatus = "PAID" | "PENDING" | "OVERDUE";

export function invoiceDisplayStatus(
  status: "PENDING" | "PAID",
  dueDate: Date,
  today: Date,
): InvoiceDisplayStatus {
  if (status === "PAID") return "PAID";
  return dueDate < today ? "OVERDUE" : "PENDING";
}

/** Correlative numbering per series and year: F2026-0001. */
export function formatInvoiceNumber(series: string, year: number, sequence: number): string {
  return `${series}${year}-${String(sequence).padStart(4, "0")}`;
}

export function nextInvoiceSequence(existingNumbers: string[], series: string, year: number): number {
  const prefix = `${series}${year}-`;
  const used = existingNumbers
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)))
    .filter(Number.isFinite);
  return (used.length ? Math.max(...used) : 0) + 1;
}
