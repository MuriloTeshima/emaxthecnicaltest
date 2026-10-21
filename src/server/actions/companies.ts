"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { type ActionResult, invalid } from "@/lib/action-result";
import { type CompanySettingsInput, type NewCompanyInput, companySettingsSchema, newCompanySchema } from "@/schemas/company";
import { COMPANY_COOKIE, getCompanyId } from "../company";
import { db } from "../db";
import { rateLimit } from "../rate-limit";

const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function updateCompanySettings(input: CompanySettingsInput): Promise<ActionResult> {
  const parsed = companySettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.company.update({ where: { id: await getCompanyId() }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function selectCompany(id: string): Promise<ActionResult> {
  const company = await db.company.findUnique({ where: { id }, select: { id: true } });
  if (!company) return { ok: false, error: "La empresa no existe." };
  (await cookies()).set(COMPANY_COOKIE, company.id, COOKIE_OPTIONS);
  return { ok: true, data: undefined };
}

/** Creates an empty company and switches to it. */
export async function createCompany(input: NewCompanyInput): Promise<ActionResult<{ id: string }>> {
  const parsed = newCompanySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`company:${ip}`, { limit: 5, windowMs: 60 * 60_000 })) {
    return { ok: false, error: "Has creado varias empresas seguidas. Inténtalo más tarde." };
  }
  const company = await db.company.create({ data: parsed.data, select: { id: true } });
  (await cookies()).set(COMPANY_COOKIE, company.id, COOKIE_OPTIONS);
  return { ok: true, data: company };
}
