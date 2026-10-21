import { NextResponse } from "next/server";
import { processDocument } from "@/server/ocr/process";
import { OcrError, SUPPORTED_MIME_TYPES, type SupportedMimeType } from "@/server/ocr/types";
import { rateLimit } from "@/server/rate-limit";

export const maxDuration = 60;

// Vercel rejects request bodies above 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`ocr:${ip}`, { limit: 15, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: "Demasiadas subidas seguidas. Espera unos minutos." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se ha recibido ningún archivo." }, { status: 400 });
  }
  if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Formato no admitido. Sube un PDF, JPG, PNG o WEBP." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera los 4 MB." }, { status: 413 });
  }

  try {
    const result = await processDocument({
      file: Buffer.from(await file.arrayBuffer()),
      fileName: file.name.slice(0, 200),
      mimeType: file.type as SupportedMimeType,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OcrError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[ocr] unexpected error", error);
    return NextResponse.json({ error: "No se ha podido procesar el documento. Puedes registrarlo manualmente." }, { status: 500 });
  }
}
