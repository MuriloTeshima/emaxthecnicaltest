import "server-only";
import { invoiceTotals } from "@/domain/invoice";
import { todayUTC } from "@/domain/period";
import type { Prisma } from "@/generated/prisma/client";
import { getCompanyId } from "../company";
import { db } from "../db";
import { toDomainLines } from "../mappers";

const include = { contact: true, lines: true, invoice: { select: { id: true, number: true } } } as const;
type QuoteRow = Prisma.QuoteGetPayload<{ include: typeof include }>;

function withTotals(quote: QuoteRow) {
  const lines = toDomainLines(quote.lines);
  const expired = (quote.status === "DRAFT" || quote.status === "SENT") && quote.validUntil < todayUTC();
  return { ...quote, domainLines: lines, totals: invoiceTotals(lines, quote.operationType), expired };
}

export async function listQuotes() {
  const companyId = await getCompanyId();
  const quotes = await db.quote.findMany({ where: { companyId }, include, orderBy: [{ issueDate: "desc" }, { number: "desc" }] });
  return quotes.map(withTotals);
}

export async function getQuote(id: string) {
  const companyId = await getCompanyId();
  const quote = await db.quote.findFirst({ where: { id, companyId }, include });
  return quote ? withTotals(quote) : null;
}
