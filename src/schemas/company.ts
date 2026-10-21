import { normalizeTaxId } from "@/domain/tax-id";
import { z } from "./zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const series = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,4}$/, "Entre 1 y 4 letras, por ejemplo F.");

export const companySettingsSchema = z
  .object({
    name: z.string().trim().min(2, "Indica la razón social."),
    nif: z.string().trim().min(1, "El NIF es obligatorio.").transform(normalizeTaxId),
    address: optionalText(200),
    email: z
      .union([z.literal(""), z.email("El email no es válido.")])
      .optional()
      .transform((v) => v || null),
    phone: optionalText(30),
    iban: optionalText(34),
    invoiceSeries: series,
    quoteSeries: series,
    paymentTermDays: z.number().int().min(0, "No puede ser negativo.").max(365, "Máximo 365 días."),
  })
  .refine((v) => v.invoiceSeries !== v.quoteSeries, {
    path: ["quoteSeries"],
    message: "Usa una serie distinta a la de facturas.",
  });

export type CompanySettingsInput = z.input<typeof companySettingsSchema>;

export const newCompanySchema = z.object({
  name: z.string().trim().min(2, "Indica la razón social."),
  nif: z.string().trim().min(1, "El NIF es obligatorio.").transform(normalizeTaxId),
});

export type NewCompanyInput = z.input<typeof newCompanySchema>;
