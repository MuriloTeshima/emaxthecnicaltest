import "server-only";
import { invoiceDisplayStatus, invoiceTotals } from "@/domain/invoice";
import { todayUTC } from "@/domain/period";
import type { Prisma } from "@/generated/prisma/client";
import { getCompanyId } from "../company";
import { db } from "../db";
import { toDomainLines } from "../mappers";

const include = { contact: true, lines: true } as const;
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

export async function listInvoices() {
  const companyId = await getCompanyId();
  const invoices = await db.invoice.findMany({
    where: { companyId },
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
