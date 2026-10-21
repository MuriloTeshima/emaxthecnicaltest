import "server-only";
import type { InvoiceLineInput } from "@/domain/invoice";
import type { TaxExpense, TaxInvoice } from "@/domain/taxes";
import type { Contact, Expense, Invoice, InvoiceLine } from "@/generated/prisma/client";

type StoredLine = Pick<InvoiceLine, "position" | "description" | "quantity" | "unitPriceCents" | "vatRate">;

/** Invoice and quote lines share this shape. */
export function toDomainLines(lines: StoredLine[]): InvoiceLineInput[] {
  return [...lines]
    .sort((a, b) => a.position - b.position)
    .map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPriceCents: l.unitPriceCents,
      vatRate: l.vatRate,
    }));
}

export function toTaxInvoice(invoice: Invoice & { lines: InvoiceLine[]; contact: Contact }): TaxInvoice {
  return {
    id: invoice.id,
    number: invoice.number,
    issueDate: invoice.issueDate,
    operationType: invoice.operationType,
    contact: { name: invoice.contact.name, nif: invoice.contact.nif, country: invoice.contact.country },
    lines: toDomainLines(invoice.lines),
  };
}

export function toTaxExpense(expense: Expense & { supplier: Contact }): TaxExpense {
  return {
    id: expense.id,
    number: expense.number,
    date: expense.date,
    operationType: expense.operationType,
    deductible: expense.deductible,
    baseCents: expense.baseCents,
    vatRate: expense.vatRate,
    vatCents: expense.vatCents,
    irpfRate: expense.irpfRate,
    irpfCents: expense.irpfCents,
    supplier: {
      id: expense.supplier.id,
      name: expense.supplier.name,
      nif: expense.supplier.nif,
      country: expense.supplier.country,
    },
  };
}
