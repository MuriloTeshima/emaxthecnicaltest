"use server";

import { revalidatePath } from "next/cache";
import { todayUTC } from "@/domain/period";
import { type ActionResult, invalid } from "@/lib/action-result";
import { type InvoiceInput, invoiceSchema } from "@/schemas/invoice";
import { getCompany } from "../company";
import { db } from "../db";
import { nextNumber, withNumberRetry } from "../numbering";

export async function createInvoice(input: InvoiceInput): Promise<ActionResult<{ id: string; number: string }>> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  const company = await getCompany();
  const contact = await db.contact.findFirst({ where: { id: data.contactId, companyId: company.id } });
  if (!contact) return { ok: false, error: "El cliente no existe.", fieldErrors: { contactId: "Selecciona un cliente." } };

  // The number is assigned server-side, inside the same transaction as the insert.
  const invoice = await withNumberRetry(() =>
    db.$transaction(async (tx) =>
      tx.invoice.create({
        data: {
          companyId: company.id,
          contactId: contact.id,
          number: await nextNumber(tx, "invoice", company.id, company.invoiceSeries, data.issueDate.getUTCFullYear()),
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          operationType: data.operationType,
          notes: data.notes,
          lines: { create: data.lines.map((line, position) => ({ ...line, position })) },
        },
        select: { id: true, number: true },
      }),
    ),
  );
  if (!invoice) return { ok: false, error: "No se pudo asignar un número de factura. Inténtalo de nuevo." };

  revalidatePath("/", "layout");
  return { ok: true, data: invoice };
}

export async function setInvoiceStatus(id: string, status: "PENDING" | "PAID"): Promise<ActionResult> {
  const company = await getCompany();
  const { count } = await db.invoice.updateMany({
    where: { id, companyId: company.id },
    data: { status, paidAt: status === "PAID" ? todayUTC() : null },
  });
  if (count === 0) return { ok: false, error: "La factura no existe." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
