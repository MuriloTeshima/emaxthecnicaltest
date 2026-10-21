import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "./db";
import { resetDemoData } from "./demo-data";

/**
 * The prototype runs as a single demo company. Every query is still scoped
 * by companyId so multi-company support only needs a way to pick it
 * (session, subdomain…) here.
 *
 * On an empty database the demo data is created on first visit, so a fresh
 * deploy works without running the seed by hand.
 */
export const getCompany = cache(async () => {
  await connection();
  const company = await db.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (company) return company;

  const id = await resetDemoData(db);
  return db.company.findUniqueOrThrow({ where: { id } });
});

export async function getCompanyId(): Promise<string> {
  return (await getCompany()).id;
}
