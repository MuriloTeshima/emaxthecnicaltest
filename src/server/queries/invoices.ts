import "server-only";
import { invoiceDisplayStatus, invoiceTotals } from "@/domain/invoice";
import { todayUTC } from "@/domain/period";
import type { Prisma } from "@/generated/prisma/client";
import { getCompanyId } from "../company";
import { db } from "../db";
import { toDomainLines } from "../mappers";
import { searchInvoiceIds } from "../search";

const include = { contact: true, lines: true, quote: { select: { id: true, number: true } } } as const;
type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof include }>;

function withTotals(invoice: InvoiceRow) {
  const lines = toDomainLines(invoice.lines);
  return {
    ...invoice,
    domainLines: lines,
    totals: invoiceTotals(lines, invoice.operationType),
    displayStatus: invoiceDisplayStatus(invoice.status, invoice.dueDate, todayUTC()),
  };
}

export interface InvoiceFilters {
  q?: string;
  status?: string; // pendiente | cobrada | vencida
  period?: { gte: Date; lt: Date };
}

export async function listInvoices(filters: InvoiceFilters = {}) {
  const companyId = await getCompanyId();
  const today = todayUTC();
  const where: Prisma.InvoiceWhereInput = { companyId };
  if (filters.q) where.id = { in: await searchInvoiceIds(companyId, filters.q) };
  if (filters.status === "cobrada") where.status = "PAID";
  if (filters.status === "pendiente") Object.assign(where, { status: "PENDING", dueDate: { gte: today } });
  if (filters.status === "vencida") Object.assign(where, { status: "PENDING", dueDate: { lt: today } });
  if (filters.period) where.issueDate = filters.period;

  const invoices = await db.invoice.findMany({
    where,
    include,
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
  });
  return invoices.map(withTotals);
}

export type InvoiceWithTotals = Awaited<ReturnType<typeof listInvoices>>[number];

export async function getInvoice(id: string) {
  const companyId = await getCompanyId();
  const invoice = await db.invoice.findFirst({ where: { id, companyId }, include });
  return invoice ? withTotals(invoice) : null;
}
