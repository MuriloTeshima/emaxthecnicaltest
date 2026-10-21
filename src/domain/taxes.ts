/**
 * Simplified estimates of Modelos 303, 111 and 349. They are derived only
 * from the documents passed in (never from hand-typed totals) and are
 * orientative: not official tax returns.
 */
import { type InvoiceLineInput, invoiceTotals } from "./invoice";
import { type Cents, percentOf, sum } from "./money";
import { type OperationType, REVERSE_CHARGE_VAT_RATE, isIntraEu } from "./rates";
import { toEuVatNumber } from "./tax-id";

export interface TaxInvoice {
  id: string;
  number: string;
  issueDate: Date;
  operationType: OperationType;
  contact: { name: string; nif: string; country: string };
  lines: InvoiceLineInput[];
}

export interface TaxExpense {
  id: string;
  number: string | null;
  date: Date;
  operationType: OperationType;
  deductible: boolean;
  baseCents: Cents;
  vatRate: number;
  vatCents: Cents;
  irpfRate: number;
  irpfCents: Cents;
  supplier: { id: string; name: string; nif: string; country: string };
}

// ─── Modelo 303 (IVA) ──────────────────────────────────────────────────────

export interface Model303Row {
  vatRate: number;
  baseCents: Cents;
  vatCents: Cents;
}

export interface Model303 {
  /** IVA devengado (repercutido) by rate, from issued invoices. */
  accrued: Model303Row[];
  accruedVatCents: Cents;
  /** Self-assessed VAT on intra-EU purchases (accrued and deductible at once). */
  reverseChargeBaseCents: Cents;
  reverseChargeVatCents: Cents;
  /** IVA soportado deducible, from deductible expenses. */
  deductibleBaseCents: Cents;
  deductibleVatCents: Cents;
  /** Informative: intra-EU supplies invoiced without VAT. */
  intraEuSuppliesBaseCents: Cents;
  /** Positive: to pay. Negative: to offset in later periods. */
  resultCents: Cents;
}

export function computeModel303(invoices: TaxInvoice[], expenses: TaxExpense[]): Model303 {
  const accruedByRate = new Map<number, Model303Row>();
  let intraEuSuppliesBaseCents = 0;

  for (const invoice of invoices) {
    const totals = invoiceTotals(invoice.lines, invoice.operationType);
    if (isIntraEu(invoice.operationType)) {
      intraEuSuppliesBaseCents += totals.baseCents;
      continue;
    }
    for (const b of totals.breakdown) {
      if (b.vatRate === 0) continue;
      const row = accruedByRate.get(b.vatRate) ?? { vatRate: b.vatRate, baseCents: 0, vatCents: 0 };
      row.baseCents += b.baseCents;
      row.vatCents += b.vatCents;
      accruedByRate.set(b.vatRate, row);
    }
  }

  let reverseChargeBaseCents = 0;
  let reverseChargeVatCents = 0;
  let deductibleBaseCents = 0;
  let deductibleVatCents = 0;

  for (const expense of expenses) {
    if (isIntraEu(expense.operationType)) {
      const vat = expense.vatCents || percentOf(expense.baseCents, REVERSE_CHARGE_VAT_RATE);
      reverseChargeBaseCents += expense.baseCents;
      reverseChargeVatCents += vat;
      if (expense.deductible) {
        deductibleBaseCents += expense.baseCents;
        deductibleVatCents += vat;
      }
      continue;
    }
    if (expense.deductible && expense.vatCents > 0) {
      deductibleBaseCents += expense.baseCents;
      deductibleVatCents += expense.vatCents;
    }
  }

  const accrued = [...accruedByRate.values()].sort((a, b) => b.vatRate - a.vatRate);
  const accruedVatCents = sum(accrued.map((r) => r.vatCents));

  return {
    accrued,
    accruedVatCents,
    reverseChargeBaseCents,
    reverseChargeVatCents,
    deductibleBaseCents,
    deductibleVatCents,
    intraEuSuppliesBaseCents,
    resultCents: accruedVatCents + reverseChargeVatCents - deductibleVatCents,
  };
}

// ─── Modelo 111 (retenciones IRPF) ─────────────────────────────────────────

export interface Model111 {
  /** Number of distinct professionals withheld from (perceptores). */
  recipients: number;
  baseCents: Cents;
  withheldCents: Cents;
  items: { expenseId: string; supplierName: string; baseCents: Cents; irpfRate: number; irpfCents: Cents }[];
}

export function computeModel111(expenses: TaxExpense[]): Model111 {
  const withheld = expenses.filter((e) => e.irpfCents > 0);
  return {
    recipients: new Set(withheld.map((e) => e.supplier.id)).size,
    baseCents: sum(withheld.map((e) => e.baseCents)),
    withheldCents: sum(withheld.map((e) => e.irpfCents)),
    items: withheld.map((e) => ({
      expenseId: e.id,
      supplierName: e.supplier.name,
      baseCents: e.baseCents,
      irpfRate: e.irpfRate,
      irpfCents: e.irpfCents,
    })),
  };
}

// ─── Modelo 349 (operaciones intracomunitarias) ────────────────────────────

/**
 * E: entregas intracomunitarias de bienes      (issued, goods)
 * S: prestaciones intracomunitarias de servicios (issued, services)
 * A: adquisiciones intracomunitarias de bienes  (received, goods)
 * I: adquisiciones intracomunitarias de servicios (received, services)
 */
export type Model349Key = "E" | "S" | "A" | "I";

export const MODEL_349_KEY_LABELS: Record<Model349Key, string> = {
  E: "Entregas de bienes",
  S: "Prestaciones de servicios",
  A: "Adquisiciones de bienes",
  I: "Adquisiciones de servicios",
};

export interface Model349Row {
  vatNumber: string;
  name: string;
  country: string;
  key: Model349Key;
  baseCents: Cents;
  documents: number;
}

export interface Model349 {
  rows: Model349Row[];
  operators: number;
  totalBaseCents: Cents;
}

export function computeModel349(invoices: TaxInvoice[], expenses: TaxExpense[]): Model349 {
  const rows = new Map<string, Model349Row>();

  const add = (party: { name: string; nif: string; country: string }, key: Model349Key, baseCents: Cents) => {
    const vatNumber = toEuVatNumber(party.country, party.nif);
    const id = `${vatNumber}|${key}`;
    const row = rows.get(id) ?? { vatNumber, name: party.name, country: party.country, key, baseCents: 0, documents: 0 };
    row.baseCents += baseCents;
    row.documents += 1;
    rows.set(id, row);
  };

  for (const invoice of invoices) {
    if (!isIntraEu(invoice.operationType)) continue;
    const key = invoice.operationType === "EU_GOODS" ? "E" : "S";
    add(invoice.contact, key, invoiceTotals(invoice.lines, invoice.operationType).baseCents);
  }
  for (const expense of expenses) {
    if (!isIntraEu(expense.operationType)) continue;
    const key = expense.operationType === "EU_GOODS" ? "A" : "I";
    add(expense.supplier, key, expense.baseCents);
  }

  const sorted = [...rows.values()].sort((a, b) => a.key.localeCompare(b.key) || b.baseCents - a.baseCents);
  return {
    rows: sorted,
    operators: new Set(sorted.map((r) => r.vatNumber)).size,
    totalBaseCents: sum(sorted.map((r) => r.baseCents)),
  };
}
