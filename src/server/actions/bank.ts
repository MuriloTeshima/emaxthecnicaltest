"use server";

import { revalidatePath } from "next/cache";
import { bankFingerprint, parseBankCsv, suggestMatches } from "@/domain/bank";
import type { ActionResult } from "@/lib/action-result";
import { getCompanyId } from "../company";
import { db } from "../db";
import { reconciliationCandidates } from "../queries/bank";

const MAX_CSV_CHARS = 500_000;

export async function importBankCsv(csv: string): Promise<ActionResult<{ imported: number; duplicates: number; errors: string[] }>> {
  if (csv.length > MAX_CSV_CHARS) return { ok: false, error: "El archivo es demasiado grande (máximo 500 KB)." };
  const { movements, errors } = parseBankCsv(csv);
  if (movements.length === 0) return { ok: false, error: errors[0] ?? "No se ha encontrado ningún movimiento." };

  const companyId = await getCompanyId();
  const { count } = await db.bankMovement.createMany({
    data: movements.map((m) => ({ companyId, ...m, fingerprint: bankFingerprint(m.date, m.amountCents, m.description) })),
    // The same statement imported twice does not duplicate movements.
    skipDuplicates: true,
  });

  revalidatePath("/bancos");
  return { ok: true, data: { imported: count, duplicates: movements.length - count, errors: errors.slice(0, 5) } };
}

async function linkMovement(companyId: string, movementId: string, target: { kind: "invoice" | "expense"; id: string }) {
  const movement = await db.bankMovement.findFirst({ where: { id: movementId, companyId } });
  if (!movement) return "El movimiento no existe.";
  if (movement.reconciledAt) return "El movimiento ya está conciliado.";

  const candidates = await reconciliationCandidates(companyId);
  const candidate = candidates.find((c) => c.kind === target.kind && c.id === target.id);
  if (!candidate) return "El documento ya está cobrado/pagado o no existe.";
  if (Math.abs(candidate.amountCents - movement.amountCents) > 1) return "El importe del movimiento no coincide con el del documento.";

  // Linking the payment also settles the document, on the date of the movement.
  await db.$transaction([
    db.bankMovement.update({
      where: { id: movement.id },
      data: { reconciledAt: new Date(), ...(target.kind === "invoice" ? { invoiceId: target.id } : { expenseId: target.id }) },
    }),
    target.kind === "invoice"
      ? db.invoice.update({ where: { id: target.id }, data: { status: "PAID", paidAt: movement.date } })
      : db.expense.update({ where: { id: target.id }, data: { status: "PAID", paidAt: movement.date } }),
  ]);
  return null;
}

export async function reconcileMovement(movementId: string, target: { kind: "invoice" | "expense"; id: string }): Promise<ActionResult> {
  const error = await linkMovement(await getCompanyId(), movementId, target);
  if (error) return { ok: false, error };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function undoReconciliation(movementId: string): Promise<ActionResult> {
  const companyId = await getCompanyId();
  const movement = await db.bankMovement.findFirst({ where: { id: movementId, companyId } });
  if (!movement?.reconciledAt) return { ok: false, error: "El movimiento no está conciliado." };

  await db.$transaction([
    db.bankMovement.update({ where: { id: movement.id }, data: { reconciledAt: null, invoiceId: null, expenseId: null } }),
    ...(movement.invoiceId ? [db.invoice.update({ where: { id: movement.invoiceId }, data: { status: "PENDING", paidAt: null } })] : []),
    ...(movement.expenseId ? [db.expense.update({ where: { id: movement.expenseId }, data: { status: "PENDING", paidAt: null } })] : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Reconciles only clear-cut matches: a single strong suggestion, or one that
 * clearly beats the next. Ambiguous movements are left for the user.
 */
export async function autoReconcile(): Promise<ActionResult<{ reconciled: number; left: number }>> {
  const companyId = await getCompanyId();
  const pending = await db.bankMovement.findMany({ where: { companyId, reconciledAt: null }, orderBy: { date: "asc" } });
  let reconciled = 0;

  for (const movement of pending) {
    const [best, second] = suggestMatches(movement, await reconciliationCandidates(companyId));
    if (!best || best.score < 50 || (second && second.score > best.score - 20)) continue;
    if (!(await linkMovement(companyId, movement.id, best))) reconciled++;
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { reconciled, left: pending.length - reconciled } };
}
