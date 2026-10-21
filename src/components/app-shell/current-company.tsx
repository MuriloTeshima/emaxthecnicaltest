import { connection } from "next/server";
import { listCompanies } from "@/server/company";
import { CompanySwitcher } from "./company-switcher";

export async function CurrentCompany() {
  // Request-time only: depends on the visitor's cookie and on live data.
  await connection();
  const { current, companies } = await listCompanies();
  return <CompanySwitcher companies={companies} currentId={current.id} />;
}
