import { z } from "zod";
import { parseISODate } from "@/domain/period";
import { OPERATION_TYPES, VAT_RATES } from "@/domain/rates";

export const isoDate = z
  .string()
  .refine((v) => parseISODate(v) !== null, "Fecha no válida.")
  .transform((v) => parseISODate(v)!);

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Describe el concepto."),
  quantity: z.number().positive("La cantidad debe ser mayor que 0.").max(1_000_000),
  unitPriceCents: z.number().int().min(0, "El precio no puede ser negativo.").max(1_000_000_000),
  vatRate: z.number().refine((r) => (VAT_RATES as readonly number[]).includes(r), "Tipo de IVA no válido."),
});

export const invoiceSchema = z
  .object({
    contactId: z.string().min(1, "Selecciona un cliente."),
    issueDate: isoDate,
    dueDate: isoDate,
    operationType: z.enum(OPERATION_TYPES),
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => v || null),
    lines: z.array(invoiceLineSchema).min(1, "Añade al menos un concepto."),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    path: ["dueDate"],
    message: "El vencimiento no puede ser anterior a la fecha de emisión.",
  });

export type InvoiceInput = z.input<typeof invoiceSchema>;
