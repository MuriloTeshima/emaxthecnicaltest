import { z } from "zod";

/** What every OCR provider returns. Amounts in euros, as printed on the document. */
export const extractedInvoiceSchema = z.object({
  supplierName: z.string().nullable().describe("Razón social del emisor (proveedor) de la factura"),
  supplierTaxId: z.string().nullable().describe("NIF/CIF o NIF-IVA del emisor, no el del cliente"),
  supplierCountry: z.string().nullable().describe("País del emisor, código ISO 3166-1 alfa-2 (ES, DE, FR…)"),
  invoiceNumber: z.string().nullable(),
  issueDate: z.string().nullable().describe("Fecha de emisión en formato YYYY-MM-DD"),
  concept: z.string().nullable().describe("Resumen breve del concepto facturado (máx. 80 caracteres)"),
  baseAmount: z.number().nullable().describe("Base imponible total en euros"),
  vatRate: z.number().nullable().describe("Tipo de IVA en porcentaje (21, 10, 4, 0)"),
  vatAmount: z.number().nullable().describe("Cuota de IVA en euros"),
  irpfRate: z.number().nullable().describe("Tipo de retención de IRPF en porcentaje (15, 7) o null si no hay"),
  irpfAmount: z.number().nullable().describe("Importe retenido de IRPF en euros, en positivo"),
  totalAmount: z.number().nullable().describe("Total a pagar en euros"),
  reverseCharge: z.boolean().describe("true si la factura indica inversión del sujeto pasivo / reverse charge"),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

export type OcrProvider = "claude" | "local-pdf" | "local-tesseract";

export interface OcrOutput {
  provider: OcrProvider;
  data: ExtractedInvoice;
  /** Raw text, when the provider produced one (local OCR). */
  text?: string;
}

export const SUPPORTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export class OcrError extends Error {}
