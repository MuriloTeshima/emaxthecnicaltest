import "server-only";
import { checkExpenseConsistency, inferRate } from "@/domain/expense";
import { centsToEuros, parseEuros } from "@/domain/money";
import { parseISODate } from "@/domain/period";
import { IRPF_RATES, VAT_RATES } from "@/domain/rates";
import { isIntraCommunityCountry, normalizeTaxId } from "@/domain/tax-id";
import { getCompany } from "../company";
import { db } from "../db";
import { extractWithClaude, isClaudeConfigured } from "./claude";
import { extractLocally } from "./local";
import { type ExtractedInvoice, type OcrOutput, OcrError, type SupportedMimeType } from "./types";
import type { OcrResponse } from "./response";

const cents = (euros: number | null) => (euros === null ? null : parseEuros(euros));
const formatAmount = (value: number | null) => (value === null ? "" : centsToEuros(value).toFixed(2).replace(".", ","));

async function extract(file: Buffer, mimeType: SupportedMimeType, buyerTaxId: string): Promise<OcrOutput & { fallbackReason?: string }> {
  if (isClaudeConfigured()) {
    try {
      return { provider: "claude", data: await extractWithClaude(file, mimeType, buyerTaxId) };
    } catch (error) {
      // Keep the flow working if the AI provider is down or rejects the file.
      console.error("[ocr] claude failed, using local extraction", error);
      const local = await extractLocally(file, mimeType, buyerTaxId);
      return { ...local, fallbackReason: "La extracción con IA no estaba disponible; se ha usado el OCR local." };
    }
  }
  return extractLocally(file, mimeType, buyerTaxId);
}

export async function processDocument(input: { file: Buffer; fileName: string; mimeType: SupportedMimeType }): Promise<OcrResponse> {
  const company = await getCompany();
  const { provider, data, text, fallbackReason } = await extract(input.file, input.mimeType, company.nif);

  const fields = normalize(data);

  const taxId = data.supplierTaxId ? normalizeTaxId(data.supplierTaxId) : null;
  let supplier = taxId
    ? await db.contact.findFirst({
        where: { companyId: company.id, OR: [{ nif: taxId }, { nif: taxId.replace(/^[A-Z]{2}(?=\d)/, "") }] },
      })
    : null;
  // A known client now also sells to us: make it usable as a supplier.
  if (supplier?.kind === "CLIENT") {
    supplier = await db.contact.update({ where: { id: supplier.id }, data: { kind: "BOTH" } });
  }

  const document = await db.document.create({
    data: {
      companyId: company.id,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.file.byteLength,
      content: new Uint8Array(input.file),
      ocrProvider: provider,
      ocrRaw: { data, text: text?.slice(0, 20_000) ?? null },
    },
    select: { id: true },
  });

  const country = (data.supplierCountry ?? (taxId?.match(/^([A-Z]{2})\d/)?.[1] || "ES")).toUpperCase();
  const intraEu = data.reverseCharge || isIntraCommunityCountry(country);

  return {
    documentId: document.id,
    provider,
    notice: fallbackReason,
    supplierId: supplier?.id ?? null,
    supplier,
    detectedSupplier: supplier ? null : { name: data.supplierName ?? "", nif: taxId ?? "", country },
    initial: {
      supplierId: supplier?.id,
      number: data.invoiceNumber ?? undefined,
      date: data.issueDate && parseISODate(data.issueDate) ? data.issueDate : undefined,
      concept: data.concept ?? undefined,
      category: (fields.irpfRate ?? 0) > 0 ? "servicios-profesionales" : "general",
      base: formatAmount(fields.baseCents),
      vatRate: fields.vatRate ?? undefined,
      irpfRate: fields.irpfRate ?? 0,
      operationType: intraEu ? "EU_SERVICES" : "DOMESTIC",
    },
    warnings: fields.warnings,
    extracted: {
      baseCents: fields.baseCents,
      vatCents: fields.vatCents,
      irpfCents: fields.irpfCents,
      totalCents: fields.totalCents,
    },
  };
}

function normalize(data: ExtractedInvoice) {
  const warnings: OcrResponse["warnings"] = {};
  let baseCents = cents(data.baseAmount);
  const vatCents = cents(data.vatAmount);
  const irpfCents = cents(data.irpfAmount === null ? null : Math.abs(data.irpfAmount));
  const totalCents = cents(data.totalAmount);

  // Some tickets only print the total and VAT: derive the base.
  if (baseCents === null && totalCents !== null && vatCents !== null) {
    baseCents = totalCents - vatCents + (irpfCents ?? 0);
    warnings.base = "Base calculada a partir del total y el IVA. Revísala.";
  }
  if (baseCents === null) warnings.base = "No se ha encontrado la base imponible.";

  let vatRate = data.vatRate;
  if (vatRate === null && baseCents !== null && vatCents !== null) vatRate = inferRate(baseCents, vatCents, VAT_RATES);
  if (vatRate !== null && !(VAT_RATES as readonly number[]).includes(vatRate)) {
    warnings.vatRate = `Tipo de IVA leído: ${vatRate}%. Elige el correcto.`;
    vatRate = null;
  }

  let irpfRate = data.irpfRate;
  if (irpfRate === null && baseCents !== null && irpfCents) irpfRate = inferRate(baseCents, irpfCents, IRPF_RATES);
  if (irpfRate !== null && !(IRPF_RATES as readonly number[]).includes(irpfRate)) {
    warnings.irpfRate = `Retención leída: ${irpfRate}%. Elige la correcta.`;
    irpfRate = null;
  }

  for (const w of checkExpenseConsistency({ baseCents, vatRate, vatCents, irpfRate, irpfCents, totalCents })) {
    if (w.field === "totalCents") warnings.total = `${w.message} Total en el documento: ${formatAmount(totalCents)} €.`;
    if (w.field === "vatCents") warnings.vatRate = w.message;
    if (w.field === "irpfCents") warnings.irpfRate = w.message;
  }
  if (!data.issueDate) warnings.date = "No se ha encontrado la fecha; se usa la de hoy.";

  return { baseCents, vatCents, irpfCents, totalCents, vatRate, irpfRate, warnings };
}

export { OcrError };
