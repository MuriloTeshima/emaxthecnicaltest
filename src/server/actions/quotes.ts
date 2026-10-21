"use server";

import { revalidatePath } from "next/cache";
import { addDays, todayUTC } from "@/domain/period";
import { type ActionResult, invalid } from "@/lib/action-result";
import { type QuoteInput, quoteSchema } from "@/schemas/quote";
import { getCompany } from "../company";
import { db } from "../db";
import { nextNumber, withNumberRetry } from "../numbering";

export async function createQuote(input: QuoteInput): Promise<ActionResult<{ id: string; number: string }>> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  const company = await getCompany();
  const contact = await db.contact.findFirst({ where: { id: data.contactId, companyId: company.id } });
  if (!contact) return { ok: false, error: "El cliente no existe.", fieldErrors: { contactId: "Selecciona un cliente." } };

  const quote = await withNumberRetry(() =>
    db.$transaction(async (tx) =>
      tx.quote.create({
        data: {
          companyId: company.id,
          contactId: contact.id,
          number: await nextNumber(tx, "quote", company.id, company.quoteSeries, data.issueDate.getUTCFullYear()),
          issueDate: data.issueDate,
          validUntil: data.validUntil,
          operationType: data.operationType,
          notes: data.notes,
          lines: { create: data.lines.map((line, position) => ({ ...line, position })) },
        },
        select: { id: true, number: true },
      }),
    ),
  );
  if (!quote) return { ok: false, error: "No se pudo asignar un número de presupuesto. Inténtalo de nuevo." };

  revalidatePath("/", "layout");
  return { ok: true, data: quote };
}

export async function setQuoteStatus(id: string, status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"): Promise<ActionResult> {
  const company = await getCompany();
  // An invoiced quote is closed: its status no longer changes.
  const { count } = await db.quote.updateMany({
    where: { id, companyId: company.id, status: { not: "INVOICED" } },
    data: { status },
  });
  if (count === 0) return { ok: false, error: "El presupuesto no existe o ya está facturado." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Creates an invoice with the quote's client and lines, dated today. */
export async function convertQuoteToInvoice(id: string): Promise<ActionResult<{ id: string; number: string }>> {
  const company = await getCompany();
  const quote = await db.quote.findFirst({ where: { id, companyId: company.id }, include: { lines: true } });
  if (!quote) return { ok: false, error: "El presupuesto no existe." };
  if (quote.invoiceId) return { ok: false, error: "Este presupuesto ya se convirtió en factura." };

  const today = todayUTC();
  const invoice = await withNumberRetry(() =>
    db.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          companyId: company.id,
          contactId: quote.contactId,
          number: await nextNumber(tx, "invoice", company.id, company.invoiceSeries, today.getUTCFullYear()),
          issueDate: today,
          dueDate: addDays(today, company.paymentTermDays),
          operationType: quote.operationType,
          notes: quote.notes ? `${quote.notes}\nSegún presupuesto ${quote.number}.` : `Según presupuesto ${quote.number}.`,
          lines: {
            create: [...quote.lines]
              .sort((a, b) => a.position - b.position)
              .map(({ position, description, quantity, unitPriceCents, vatRate }) => ({ position, description, quantity, unitPriceCents, vatRate })),
          },
        },
        select: { id: true, number: true },
      });
      // Guard against a double click converting the same quote twice.
      const { count } = await tx.quote.updateMany({
        where: { id: quote.id, invoiceId: null },
        data: { status: "INVOICED", invoiceId: created.id },
      });
      if (count === 0) throw new Error("QUOTE_ALREADY_INVOICED");
      return created;
    }),
  ).catch((error) => {
    if (error instanceof Error && error.message === "QUOTE_ALREADY_INVOICED") return "already" as const;
    throw error;
  });

  if (invoice === "already") return { ok: false, error: "Este presupuesto ya se convirtió en factura." };
  if (!invoice) return { ok: false, error: "No se pudo crear la factura. Inténtalo de nuevo." };

  revalidatePath("/", "layout");
  return { ok: true, data: invoice };
}
