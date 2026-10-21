"use server";

import { headers } from "next/headers";
import type { ActionResult } from "@/lib/action-result";
import { db } from "../db";
import { resetDemoData } from "../demo-data";
import { rateLimit } from "../rate-limit";

export async function resetDemo(): Promise<ActionResult> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`reset:${ip}`, { limit: 5, windowMs: 10 * 60_000 })) {
    return { ok: false, error: "Demasiados reinicios seguidos. Espera unos minutos." };
  }
  // No revalidation: the client reloads the whole page right after.
  await resetDemoData(db);
  return { ok: true, data: undefined };
}
