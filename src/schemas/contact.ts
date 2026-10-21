import { z } from "./zod";
import { normalizeTaxId } from "@/domain/tax-id";

export const contactSchema = z.object({
  kind: z.enum(["CLIENT", "SUPPLIER", "BOTH"]),
  name: z.string().trim().min(2, "Indica el nombre o razón social."),
  nif: z
    .string()
    .trim()
    .min(1, "El NIF es obligatorio.")
    .transform(normalizeTaxId),
  country: z
    .string()
    .trim()
    .length(2, "Selecciona un país.")
    .transform((c) => c.toUpperCase()),
  email: z
    .union([z.literal(""), z.email("El email no es válido.")])
    .optional()
    .transform((v) => v || null),
  isProfessional: z.boolean().default(false),
});

export type ContactInput = z.input<typeof contactSchema>;
