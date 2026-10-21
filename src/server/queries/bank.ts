import "server-only";
import { type MatchCandidate, type MatchSuggestion, suggestMatches } from "@/domain/bank";
import { invoiceTotals } from "@/domain/invoice";
import { sum } from "@/domain/money";
import { getCompanyId } from "../company";
import { db } from "../db";
import { toDomainLines } from "../mappers";

/** Pending invoices (money in) and pending expenses (money out) not yet linked to a movement. */
export async function reconciliationCandidates(companyId: string): Promise<MatchCandidate[]> {
  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({ where: { companyId, status: "PENDING", bankMovements: { none: {} } }, include: { lines: true, contact: true } }),
    db.expense.findMany({ where: { companyId, status: "PENDING", bankMovements: { none: {} } }, include: { supplier: true } }),
  ]);
  return [
    ...invoices.map((i) => ({
      kind: "invoice" as const,
      id: i.id,
      amountCents: invoiceTotals(toDomainLines(i.lines), i.operationType).totalCents,
      date: i.issueDate,
      label: `Factura ${i.number}`,
      reference: i.number,
      counterparty: i.contact.name,
    })),
    ...expenses.map((e) => ({
      kind: "expense" as const,
      id: e.id,
      amountCents: -e.totalCents,
      date: e.date,
      label: e.number ? `Gasto ${e.number}` : `Gasto: ${e.concept}`,
      reference: e.number,
      counterparty: e.supplier.name,
    })),
  ];
}

export async function getBankOverview(filter: string, query = "") {
  const companyId = await getCompanyId();
  const [movements, candidates] = await Promise.all([
    db.bankMovement.findMany({
      where: {
        companyId,
        ...(filter === "pendiente" ? { reconciledAt: null } : filter === "conciliado" ? { reconciledAt: { not: null } } : {}),
        ...(query ? { description: { contains: query, mode: "insensitive" as const } } : {}),
      },
      include: {
        invoice: { select: { id: true, number: true, contact: { select: { name: true } } } },
        expense: { select: { id: true, number: true, concept: true, supplier: { select: { name: true } } } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    reconciliationCandidates(companyId),
  ]);

  const all = await db.bankMovement.findMany({ where: { companyId }, select: { amountCents: true, reconciledAt: true } });

  return {
    movements: movements.map((m) => ({
      ...m,
      suggestions: m.reconciledAt ? ([] as MatchSuggestion[]) : suggestMatches(m, candidates).slice(0, 3),
    })),
    summary: {
      balanceCents: sum(all.map((m) => m.amountCents)),
      total: all.length,
      pending: all.filter((m) => !m.reconciledAt).length,
    },
  };
}

export type BankMovementRow = Awaited<ReturnType<typeof getBankOverview>>["movements"][number];
