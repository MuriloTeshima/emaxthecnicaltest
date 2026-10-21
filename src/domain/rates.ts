export const VAT_RATES = [21, 10, 4, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];

/** 15% general rate for professionals, 7% for the first years of activity. */
export const IRPF_RATES = [0, 7, 15] as const;
export type IrpfRate = (typeof IRPF_RATES)[number];

export const DEFAULT_VAT_RATE: VatRate = 21;
export const DEFAULT_PROFESSIONAL_IRPF: IrpfRate = 15;

/** Rate used to self-assess VAT on intra-EU purchases (inversión del sujeto pasivo). */
export const REVERSE_CHARGE_VAT_RATE: VatRate = 21;

export const DEFAULT_PAYMENT_TERM_DAYS = 30;

export const OPERATION_TYPES = ["DOMESTIC", "EU_GOODS", "EU_SERVICES"] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

export function isIntraEu(op: OperationType): boolean {
  return op === "EU_GOODS" || op === "EU_SERVICES";
}
