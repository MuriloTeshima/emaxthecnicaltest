import type { DetectedSupplier, ExpenseFormInitial } from "@/components/expenses/expense-form";
import type { Contact } from "@/generated/prisma/browser";
import type { OcrProvider } from "./types";

/** Payload returned by POST /api/ocr to the upload screen. */
export interface OcrResponse {
  documentId: string;
  provider: OcrProvider;
  notice?: string;
  supplierId: string | null;
  /** Matched contact, so the form can list it even if it was not a supplier before. */
  supplier: Contact | null;
  detectedSupplier: DetectedSupplier | null;
  initial: ExpenseFormInitial;
  warnings: Partial<Record<"base" | "vatRate" | "irpfRate" | "total" | "date" | "supplier", string>>;
  extracted: { baseCents: number | null; vatCents: number | null; irpfCents: number | null; totalCents: number | null };
}
