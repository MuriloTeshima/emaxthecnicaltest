"use server";

import { revalidatePath } from "next/cache";
import { expenseAmounts } from "@/domain/expense";
import { REVERSE_CHARGE_VAT_RATE, isIntraEu } from "@/domain/rates";
import { todayUTC } from "@/domain/period";
import { type ActionResult, invalid } from "@/lib/action-result";
import { type ExpenseInput, expenseSchema } from "@/schemas/expense";
import { getCompanyId } from "../company";
import { db } from "../db";

export async function createExpense(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { paid, documentId, ...data } = parsed.data;

  const companyId = await getCompanyId();
  const supplier = await db.contact.findFirst({ where: { id: data.supplierId, companyId } });
  if (!supplier) return { ok: false, error: "El proveedor no existe.", fieldErrors: { supplierId: "Selecciona un proveedor." } };

  if (documentId) {
    const document = await db.document.findFirst({ where: { id: documentId, companyId }, include: { expense: true } });
    if (!document) return { ok: false, error: "El documento adjunto no existe." };
    if (document.expense) return { ok: false, error: "Este documento ya está registrado como gasto." };
  }

  // Intra-EU purchases: VAT is self-assessed at the general rate (reverse charge).
  const vatRate = isIntraEu(data.operationType) ? REVERSE_CHARGE_VAT_RATE : data.vatRate;
  const amounts = expenseAmounts({ baseCents: data.baseCents, vatRate, irpfRate: data.irpfRate, operationType: data.operationType });

  const expense = await db.expense.create({
    data: {
      ...data,
      ...amounts,
      vatRate,
      companyId,
      status: paid ? "PAID" : "PENDING",
      paidAt: paid ? data.date : null,
      source: documentId ? "OCR" : "MANUAL",
      documentId: documentId ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/", "layout");
  return { ok: true, data: expense };
}

export async function setExpenseStatus(id: string, status: "PENDING" | "PAID"): Promise<ActionResult> {
  const companyId = await getCompanyId();
  const { count } = await db.expense.updateMany({
    where: { id, companyId },
    data: { status, paidAt: status === "PAID" ? todayUTC() : null },
  });
  if (count === 0) return { ok: false, error: "El gasto no existe." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
