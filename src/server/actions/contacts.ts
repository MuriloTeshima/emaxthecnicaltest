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
