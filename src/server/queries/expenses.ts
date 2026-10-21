import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getCompanyId } from "../company";
import { db } from "../db";
import { searchExpenseIds } from "../search";

export interface ExpenseFilters {
  q?: string;
  status?: string; // pagado | pendiente
  category?: string;
  period?: { gte: Date; lt: Date };
}

export async function listExpenses(filters: ExpenseFilters = {}) {
  const companyId = await getCompanyId();
  const where: Prisma.ExpenseWhereInput = { companyId };
  if (filters.q) where.id = { in: await searchExpenseIds(companyId, filters.q) };
  if (filters.status === "pagado") where.status = "PAID";
  if (filters.status === "pendiente") where.status = "PENDING";
  if (filters.category) where.category = filters.category;
  if (filters.period) where.date = filters.period;

  return db.expense.findMany({
    where,
    include: { supplier: true, document: { select: { fileName: true, ocrProvider: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];
