import { OPERATION_TYPES } from "@/domain/rates";
import { invoiceLineSchema, isoDate } from "./invoice";
import { z } from "./zod";

export const quoteSchema = z
  .object({
    contactId: z.string().min(1, "Selecciona un cliente."),
    issueDate: isoDate,
    validUntil: isoDate,
    operationType: z.enum(OPERATION_TYPES),
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => v || null),
    lines: z.array(invoiceLineSchema).min(1, "Añade al menos un concepto."),
  })
  .refine((v) => v.validUntil >= v.issueDate, {
    path: ["validUntil"],
    message: "La validez no puede terminar antes de la fecha del presupuesto.",
  });

export type QuoteInput = z.input<typeof quoteSchema>;

export const QUOTE_STATUS_LABELS = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  INVOICED: "Facturado",
} as const;
