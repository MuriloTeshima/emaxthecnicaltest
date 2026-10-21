import { z } from "zod";
import { IRPF_RATES, OPERATION_TYPES, VAT_RATES } from "@/domain/rates";
import { isoDate } from "./invoice";

export const EXPENSE_CATEGORIES = {
  "servicios-profesionales": "Servicios profesionales",
  suministros: "Suministros (luz, agua, telefonía)",
  material: "Material y compras",
  alquiler: "Alquiler",
  software: "Software y suscripciones",
  transporte: "Transporte y viajes",
  general: "Otros gastos",
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const expenseSchema = z.object({
  supplierId: z.string().min(1, "Selecciona un proveedor."),
  number: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || null),
  date: isoDate,
  concept: z.string().trim().min(1, "Describe el gasto.").max(200),
  category: z.enum(Object.keys(EXPENSE_CATEGORIES) as [ExpenseCategory, ...ExpenseCategory[]]),
  baseCents: z.number().int().positive("La base imponible debe ser mayor que 0.").max(1_000_000_000),
  vatRate: z.number().refine((r) => (VAT_RATES as readonly number[]).includes(r), "Tipo de IVA no válido."),
  irpfRate: z.number().refine((r) => (IRPF_RATES as readonly number[]).includes(r), "Tipo de IRPF no válido."),
  operationType: z.enum(OPERATION_TYPES),
  deductible: z.boolean(),
  paid: z.boolean(),
  documentId: z.string().optional().nullable(),
});

export type ExpenseInput = z.input<typeof expenseSchema>;
