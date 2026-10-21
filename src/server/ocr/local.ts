import "server-only";
import { tmpdir } from "node:os";
import { extractText, getDocumentProxy } from "unpdf";
import { extractInvoiceFromText } from "@/domain/invoice-text";
import { centsToEuros } from "@/domain/money";
import { isIntraCommunityCountry } from "@/domain/tax-id";
import { type OcrOutput, OcrError, type SupportedMimeType } from "./types";

/**
 * Fallback without an AI provider: the PDF text layer (digital invoices) or
 * Tesseract for images and scanned PDFs, followed by heuristic parsing.
 */
export async function extractLocally(file: Buffer, mimeType: SupportedMimeType, buyerTaxId: string): Promise<OcrOutput> {
  let text = "";
  let provider: OcrOutput["provider"];

  if (mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(file));
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
    provider = "local-pdf";
    if (text.trim().length < 20) {
      throw new OcrError("El PDF no tiene texto (parece escaneado). Sube una foto o configura la extracción con IA.");
    }
  } else {
    const { createWorker } = await import("tesseract.js");
    // Serverless file systems are read-only except /tmp, where the language model is cached.
    const worker = await createWorker("spa", undefined, { cachePath: tmpdir() });
    try {
      text = (await worker.recognize(file)).data.text;
    } finally {
      await worker.terminate();
    }
    provider = "local-tesseract";
  }

  const parsed = extractInvoiceFromText(text, { excludeTaxIds: [buyerTaxId] });
  const euros = (cents: number | null) => (cents === null ? null : centsToEuros(cents));
  const country = parsed.supplierTaxId?.match(/^([A-Z]{2})\d/)?.[1] ?? (parsed.supplierTaxId ? "ES" : null);

  return {
    provider,
    text,
    data: {
      supplierName: parsed.supplierName,
      supplierTaxId: parsed.supplierTaxId,
      supplierCountry: country,
      invoiceNumber: parsed.invoiceNumber,
      issueDate: parsed.issueDate,
      concept: null,
      baseAmount: euros(parsed.baseCents),
      vatRate: parsed.vatRate,
      vatAmount: euros(parsed.vatCents),
      irpfRate: parsed.irpfRate,
      irpfAmount: euros(parsed.irpfCents),
      totalAmount: euros(parsed.totalCents),
      reverseCharge: country !== null && isIntraCommunityCountry(country) && !parsed.vatCents,
    },
  };
}
