import "server-only";
import { getCompanyId } from "../company";
import { db } from "../db";

export async function listExpenses() {
  const companyId = await getCompanyId();
  return db.expense.findMany({
    where: { companyId },
    include: { supplier: true, document: { select: { fileName: true, ocrProvider: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];
