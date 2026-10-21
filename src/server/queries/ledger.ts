import "server-only";
import { invoiceDisplayStatus, invoiceTotals } from "@/domain/invoice";
import { sum } from "@/domain/money";
import { type Period, quarterRange, todayUTC } from "@/domain/period";
import { computeModel111, computeModel303, computeModel349 } from "@/domain/taxes";
import { getCompanyId } from "../company";
import { db } from "../db";
import { toTaxExpense, toTaxInvoice } from "../mappers";

async function loadDocuments(companyId: string, start: Date, end: Date) {
  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({
      where: { companyId, issueDate: { gte: start, lt: end } },
      include: { contact: true, lines: true },
      orderBy: { issueDate: "asc" },
    }),
    db.expense.findMany({
      where: { companyId, date: { gte: start, lt: end } },
      include: { supplier: true },
      orderBy: { date: "asc" },
    }),
  ]);
  return { invoices, expenses };
}

/** Tax estimates for one quarter, computed from the stored documents. */
export async function getTaxReport(period: Period) {
  const companyId = await getCompanyId();
  const { start, end } = quarterRange(period);
  const { invoices, expenses } = await loadDocuments(companyId, start, end);
  const taxInvoices = invoices.map(toTaxInvoice);
  const taxExpenses = expenses.map(toTaxExpense);

  return {
    m303: computeModel303(taxInvoices, taxExpenses),
    m111: computeModel111(taxExpenses),
    m349: computeModel349(taxInvoices, taxExpenses),
    counts: { invoices: invoices.length, expenses: expenses.length },
  };
}

export async function getDashboard(period: Period) {
  const companyId = await getCompanyId();
  const today = todayUTC();
  const { start, end } = quarterRange(period);
  const yearStart = new Date(Date.UTC(period.year, 0, 1));
  const yearEnd = new Date(Date.UTC(period.year + 1, 0, 1));

  const [{ invoices, expenses }, pendingInvoices] = await Promise.all([
    loadDocuments(companyId, yearStart, yearEnd),
    db.invoice.findMany({ where: { companyId, status: "PENDING" }, include: { lines: true } }),
  ]);

  const invoicesWithTotals = invoices.map((i) => ({ ...i, totals: invoiceTotals(toTaxInvoice(i).lines, i.operationType) }));
  const inQuarter = <T extends { date: Date }>(rows: T[]) => rows.filter((r) => r.date >= start && r.date < end);

  const quarterInvoices = inQuarter(invoicesWithTotals.map((i) => ({ ...i, date: i.issueDate })));
  const quarterExpenses = inQuarter(expenses);

  // Income and expenses are shown net of VAT (base imponible), as in accounting.
  const incomeCents = sum(quarterInvoices.map((i) => i.totals.baseCents));
  const expenseCents = sum(quarterExpenses.map((e) => e.baseCents));

  const pending = pendingInvoices.map((i) => {
    const lines = i.lines.map((l) => ({ ...l, quantity: Number(l.quantity) }));
    return {
      totalCents: invoiceTotals(lines, i.operationType).totalCents,
      overdue: invoiceDisplayStatus(i.status, i.dueDate, today) === "OVERDUE",
    };
  });

  const months = Array.from({ length: 12 }, (_, month) => ({
    month,
    incomeCents: sum(invoicesWithTotals.filter((i) => i.issueDate.getUTCMonth() === month).map((i) => i.totals.baseCents)),
    expenseCents: sum(expenses.filter((e) => e.date.getUTCMonth() === month).map((e) => e.baseCents)),
  }));

  const quarterTaxInvoices = quarterInvoices.map(toTaxInvoice);
  const quarterTaxExpenses = quarterExpenses.map(toTaxExpense);

  const recent = [
    ...invoicesWithTotals.map((i) => ({
      kind: "invoice" as const,
      id: i.id,
      date: i.issueDate,
      title: i.contact.name,
      subtitle: i.number,
      amountCents: i.totals.totalCents,
      createdAt: i.createdAt,
    })),
    ...expenses.map((e) => ({
      kind: "expense" as const,
      id: e.id,
      date: e.date,
      title: e.supplier.name,
      subtitle: e.concept,
      amountCents: e.totalCents,
      createdAt: e.createdAt,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);

  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    pendingCents: sum(pending.map((p) => p.totalCents)),
    pendingCount: pending.length,
    overdueCount: pending.filter((p) => p.overdue).length,
    vatResultCents: computeModel303(quarterTaxInvoices, quarterTaxExpenses).resultCents,
    withheldCents: computeModel111(quarterTaxExpenses).withheldCents,
    months,
    recent,
  };
}
