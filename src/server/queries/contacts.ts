import "server-only";
import { invoiceDisplayStatus, invoiceTotals } from "@/domain/invoice";
import { sum } from "@/domain/money";
import { todayUTC } from "@/domain/period";
import type { Prisma } from "@/generated/prisma/client";
import { getCompanyId } from "../company";
import { db } from "../db";
import { toDomainLines } from "../mappers";
import { searchContactIds } from "../search";

export type ContactRole = "CLIENT" | "SUPPLIER";

export async function listContacts(role?: ContactRole) {
  const companyId = await getCompanyId();
  return db.contact.findMany({
    where: { companyId, ...(role ? { kind: { in: [role, "BOTH"] } } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function listContactsWithActivity(filters: { q?: string; kind?: string } = {}) {
  const companyId = await getCompanyId();
  const where: Prisma.ContactWhereInput = { companyId };
  if (filters.q) where.id = { in: await searchContactIds(companyId, filters.q) };
  if (filters.kind === "cliente") where.kind = { in: ["CLIENT", "BOTH"] };
  if (filters.kind === "proveedor") where.kind = { in: ["SUPPLIER", "BOTH"] };
  return db.contact.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { invoices: true, quotes: true, expenses: true } } },
  });
}

export async function getContactDetail(id: string) {
  const companyId = await getCompanyId();
  const contact = await db.contact.findFirst({
    where: { id, companyId },
    include: {
      invoices: { include: { lines: true }, orderBy: { issueDate: "desc" } },
      quotes: { include: { lines: true }, orderBy: { issueDate: "desc" } },
      expenses: { orderBy: { date: "desc" } },
    },
  });
  if (!contact) return null;

  const today = todayUTC();
  const invoices = contact.invoices.map((i) => ({
    ...i,
    totalCents: invoiceTotals(toDomainLines(i.lines), i.operationType).totalCents,
    displayStatus: invoiceDisplayStatus(i.status, i.dueDate, today),
  }));
  const quotes = contact.quotes.map((q) => ({ ...q, totalCents: invoiceTotals(toDomainLines(q.lines), q.operationType).totalCents }));

  return {
    ...contact,
    invoices,
    quotes,
    stats: {
      invoicedCents: sum(invoices.map((i) => i.totalCents)),
      pendingCents: sum(invoices.filter((i) => i.status === "PENDING").map((i) => i.totalCents)),
      spentCents: sum(contact.expenses.map((e) => e.totalCents)),
      toPayCents: sum(contact.expenses.filter((e) => e.status === "PENDING").map((e) => e.totalCents)),
    },
  };
}
