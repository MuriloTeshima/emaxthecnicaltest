import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { resetDemoData } from "./demo-data";

export const COMPANY_COOKIE = "ef_company";

/**
 * The current company comes from a cookie set by the company switcher. There
 * is no login in the prototype, so it falls back to the demo company. Every
 * query is scoped by this company's id.
 *
 * On an empty database the demo data is created on first visit, so a fresh
 * deploy works without running the seed by hand.
 */
export const getCompany = cache(async () => {
  const selectedId = (await cookies()).get(COMPANY_COOKIE)?.value;
  if (selectedId) {
    const selected = await db.company.findUnique({ where: { id: selectedId } });
    if (selected) return selected;
  }

  const demo = await db.company.findFirst({ where: { isDemo: true } });
  if (demo) return demo;

  const id = await resetDemoData(db);
  return db.company.findUniqueOrThrow({ where: { id } });
});

export async function getCompanyId(): Promise<string> {
  return (await getCompany()).id;
}

export async function listCompanies() {
  const current = await getCompany();
  const companies = await db.company.findMany({
    orderBy: [{ isDemo: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, nif: true, isDemo: true },
  });
  return { current, companies };
}
