import "server-only";
import { formatInvoiceNumber, nextInvoiceSequence } from "@/domain/invoice";
import { Prisma } from "@/generated/prisma/client";
import type { db } from "./db";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Next correlative number for a series and year, read inside the transaction. */
export async function nextNumber(tx: Tx, kind: "invoice" | "quote", companyId: string, series: string, year: number) {
  const where = { companyId, number: { startsWith: `${series}${year}-` } };
  const existing =
    kind === "invoice"
      ? await tx.invoice.findMany({ where, select: { number: true } })
      : await tx.quote.findMany({ where, select: { number: true } });
  return formatInvoiceNumber(series, year, nextInvoiceSequence(existing.map((e) => e.number), series, year));
}

/**
 * Runs a create that assigns a number. The unique (companyId, number) index
 * protects against two concurrent saves; on a clash it retries with the next.
 */
export async function withNumberRetry<T>(create: () => Promise<T>): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await create();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return null;
}
