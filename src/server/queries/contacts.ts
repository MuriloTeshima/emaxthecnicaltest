import "server-only";
import { getCompanyId } from "../company";
import { db } from "../db";

export type ContactRole = "CLIENT" | "SUPPLIER";

export async function listContacts(role?: ContactRole) {
  const companyId = await getCompanyId();
  return db.contact.findMany({
    where: { companyId, ...(role ? { kind: { in: [role, "BOTH"] } } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function listContactsWithActivity() {
  const companyId = await getCompanyId();
  return db.contact.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { _count: { select: { invoices: true, expenses: true } } },
  });
}
