import "server-only";
import { db } from "./db";

/**
 * Accent- and case-insensitive text search (Postgres unaccent + ILIKE), so
 * "muller" finds "Müller" and "asesoria" finds "Asesoría". Returns ids to
 * combine with the regular Prisma filters. Queries are parameterized.
 */

function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function searchInvoiceIds(companyId: string, query: string): Promise<string[]> {
  const pattern = likePattern(query);
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT i.id
    FROM "Invoice" i
    JOIN "Contact" c ON c.id = i."contactId"
    LEFT JOIN "InvoiceLine" l ON l."invoiceId" = i.id
    WHERE i."companyId" = ${companyId}
      AND (unaccent(i.number) ILIKE unaccent(${pattern})
        OR unaccent(c.name) ILIKE unaccent(${pattern})
        OR unaccent(l.description) ILIKE unaccent(${pattern}))`;
  return rows.map((r) => r.id);
}

export async function searchExpenseIds(companyId: string, query: string): Promise<string[]> {
  const pattern = likePattern(query);
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT e.id
    FROM "Expense" e
    JOIN "Contact" c ON c.id = e."supplierId"
    WHERE e."companyId" = ${companyId}
      AND (unaccent(e.concept) ILIKE unaccent(${pattern})
        OR unaccent(coalesce(e.number, '')) ILIKE unaccent(${pattern})
        OR unaccent(c.name) ILIKE unaccent(${pattern}))`;
  return rows.map((r) => r.id);
}

export async function searchContactIds(companyId: string, query: string): Promise<string[]> {
  const pattern = likePattern(query);
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Contact"
    WHERE "companyId" = ${companyId}
      AND (unaccent(name) ILIKE unaccent(${pattern})
        OR nif ILIKE ${pattern}
        OR unaccent(coalesce(email, '')) ILIKE unaccent(${pattern}))`;
  return rows.map((r) => r.id);
}
