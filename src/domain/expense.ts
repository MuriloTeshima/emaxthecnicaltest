import { type Cents, percentOf } from "./money";
import { type OperationType, isIntraEu } from "./rates";

export interface ExpenseAmountsInput {
  baseCents: Cents;
  vatRate: number;
  irpfRate: number;
  operationType?: OperationType;
}

export interface ExpenseAmounts {
  baseCents: Cents;
  vatCents: Cents;
  irpfCents: Cents;
  /** What is actually paid to the supplier. */
  totalCents: Cents;
}

/**
 * Total to pay = base + VAT − IRPF withholding.
 * For intra-EU purchases the supplier charges no VAT: we self-assess it
 * (it is both accrued and deductible in Modelo 303), so it is not part of
 * the amount paid.
 */
export function expenseAmounts(input: ExpenseAmountsInput): ExpenseAmounts {
  const vatCents = percentOf(input.baseCents, input.vatRate);
  const irpfCents = percentOf(input.baseCents, input.irpfRate);
  const paidVat = isIntraEu(input.operationType ?? "DOMESTIC") ? 0 : vatCents;
  return {
    baseCents: input.baseCents,
    vatCents,
    irpfCents,
    totalCents: input.baseCents + paidVat - irpfCents,
  };
}

export interface ExtractedAmounts {
  baseCents?: Cents | null;
  vatRate?: number | null;
  vatCents?: Cents | null;
  irpfRate?: number | null;
  irpfCents?: Cents | null;
  totalCents?: Cents | null;
}

export interface ConsistencyWarning {
  field: "vatCents" | "irpfCents" | "totalCents";
  message: string;
}

/** Tolerance for rounding differences on documents, in cents. */
const TOLERANCE = 2;

/**
 * Cross-checks the amounts read from a document (OCR or manual entry)
 * against what the rates imply, so extraction errors surface before saving.
 */
export function checkExpenseConsistency(a: ExtractedAmounts): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = [];
  if (a.baseCents == null) return warnings;

  if (a.vatRate != null && a.vatCents != null) {
    const expected = percentOf(a.baseCents, a.vatRate);
    if (Math.abs(expected - a.vatCents) > TOLERANCE) {
      warnings.push({ field: "vatCents", message: `La cuota de IVA no coincide con el ${a.vatRate}% de la base.` });
    }
  }
  if (a.irpfRate != null && a.irpfCents != null) {
    const expected = percentOf(a.baseCents, a.irpfRate);
    if (Math.abs(expected - a.irpfCents) > TOLERANCE) {
      warnings.push({ field: "irpfCents", message: `La retención no coincide con el ${a.irpfRate}% de la base.` });
    }
  }
  if (a.totalCents != null) {
    const expected = a.baseCents + (a.vatCents ?? 0) - (a.irpfCents ?? 0);
    if (Math.abs(expected - a.totalCents) > TOLERANCE) {
      warnings.push({ field: "totalCents", message: "El total no cuadra con base + IVA − IRPF." });
    }
  }
  return warnings;
}

/** Infers a rate from base and amount when a document only shows amounts. */
export function inferRate(baseCents: Cents, amountCents: Cents, candidates: readonly number[]): number | null {
  if (baseCents <= 0) return null;
  const match = candidates.find((rate) => Math.abs(percentOf(baseCents, rate) - amountCents) <= TOLERANCE);
  return match ?? null;
}
