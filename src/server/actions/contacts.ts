"use server";

import { revalidatePath } from "next/cache";
import type { Contact } from "@/generated/prisma/client";
import { type ActionResult, invalid } from "@/lib/action-result";
import { type ContactInput, contactSchema } from "@/schemas/contact";
import { getCompanyId } from "../company";
import { db } from "../db";

export async function createContact(input: ContactInput): Promise<ActionResult<Contact>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const companyId = await getCompanyId();
  const existing = await db.contact.findFirst({ where: { companyId, nif: parsed.data.nif } });
  if (existing) {
    return { ok: false, error: `Ya existe un contacto con ese NIF: ${existing.name}.`, fieldErrors: { nif: "NIF ya registrado." } };
  }

  const contact = await db.contact.create({ data: { ...parsed.data, companyId } });
  revalidatePath("/", "layout");
  return { ok: true, data: contact };
}

export async function updateContact(id: string, input: ContactInput): Promise<ActionResult<Contact>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const companyId = await getCompanyId();
  const contact = await db.contact.findFirst({
    where: { id, companyId },
    include: { _count: { select: { invoices: true, quotes: true, expenses: true } } },
  });
  if (!contact) return { ok: false, error: "El contacto no existe." };

  const duplicate = await db.contact.findFirst({ where: { companyId, nif: parsed.data.nif, id: { not: id } } });
  if (duplicate) {
    return { ok: false, error: `Ya existe un contacto con ese NIF: ${duplicate.name}.`, fieldErrors: { nif: "NIF ya registrado." } };
  }

  // Keep existing documents reachable from their lists.
  const { kind } = parsed.data;
  if (kind === "SUPPLIER" && contact._count.invoices + contact._count.quotes > 0) {
    return { ok: false, error: "Tiene facturas o presupuestos emitidos: elige «Cliente y proveedor».", fieldErrors: { kind: "No puede dejar de ser cliente." } };
  }
  if (kind === "CLIENT" && contact._count.expenses > 0) {
    return { ok: false, error: "Tiene gastos registrados: elige «Cliente y proveedor».", fieldErrors: { kind: "No puede dejar de ser proveedor." } };
  }

  const updated = await db.contact.update({ where: { id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true, data: updated };
}
