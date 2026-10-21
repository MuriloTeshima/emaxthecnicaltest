"use server";

import { revalidatePath } from "next/cache";
import { formatInvoiceNumber, nextInvoiceSequence } from "@/domain/invoice";
import { todayUTC } from "@/domain/period";
import { Prisma } from "@/generated/prisma/client";
import { type ActionResult, invalid } from "@/lib/action-result";
import { type InvoiceInput, invoiceSchema } from "@/schemas/invoice";
import { getCompany } from "../company";
import { db } from "../db";

export async function createInvoice(input: InvoiceInput): Promise<ActionResult<{ id: string; number: string }>> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  const company = await getCompany();
  const contact = await db.contact.findFirst({ where: { id: data.contactId, companyId: company.id } });
  if (!contact) return { ok: false, error: "El cliente no existe.", fieldErrors: { contactId: "Selecciona un cliente." } };

  const year = data.issueDate.getUTCFullYear();

  // The number is assigned server-side. The unique (companyId, number) index
  // protects against two concurrent saves; retry with the next one if it hits.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const invoice = await db.$transaction(async (tx) => {
        const existing = await tx.invoice.findMany({
          where: { companyId: company.id, number: { startsWith: `${company.invoiceSeries}${year}-` } },
          select: { number: true },
        });
        const number = formatInvoiceNumber(
          company.invoiceSeries,
          year,
          nextInvoiceSequence(existing.map((i) => i.number), company.invoiceSeries, year),
        );
        return tx.invoice.create({
          data: {
            companyId: company.id,
            contactId: contact.id,
            number,
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            operationType: data.operationType,
            notes: data.notes,
            lines: { create: data.lines.map((line, position) => ({ ...line, position })) },
          },
          select: { id: true, number: true },
        });
      });
      revalidatePath("/", "layout");
      return { ok: true, data: invoice };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return { ok: false, error: "No se pudo asignar un número de factura. Inténtalo de nuevo." };
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
