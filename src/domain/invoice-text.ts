/**
 * Heuristic extraction of invoice fields from plain text (PDF text layer or
 * Tesseract output). Used when no AI provider is configured. It is
 * deliberately conservative: a field it cannot find is left null so the user
 * fills it in, instead of guessing.
 */
import { type Cents, parseEuros } from "./money";
import { normalizeTaxId } from "./tax-id";

export interface TextExtraction {
  supplierName: string | null;
  supplierTaxId: string | null;
  invoiceNumber: string | null;
  issueDate: string | null; // YYYY-MM-DD
  baseCents: Cents | null;
  vatRate: number | null;
  vatCents: Cents | null;
  irpfRate: number | null;
  irpfCents: Cents | null;
  totalCents: Cents | null;
}

const SPANISH_TAX_ID = /\b(?:ES)?([A-HJ-NP-SUVW][-\s]?\d{7}[-\s]?[0-9A-J]|\d{8}[-\s]?[A-Z]|[XYZ][-\s]?\d{7}[-\s]?[A-Z])\b/g;
const EU_VAT_NUMBER = /\b((?:AT|BE|BG|CY|CZ|DE|DK|EE|EL|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)[0-9A-Z]{8,12})\b/g;
const AMOUNT = /-?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|-?\d+(?:[.,]\d{1,2})?/g;

function lastAmount(line: string): Cents | null {
  // Ignore percentages so "IVA 21% 210,00" yields 210,00, not 21.
  const cleaned = line.replace(/\d+(?:[.,]\d+)?\s*%/g, " ");
  const matches = cleaned.match(AMOUNT);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    const value = parseEuros(matches[i].replace(/\s/g, ""));
    if (value !== null) return value;
  }
  return null;
}

function percentIn(line: string): number | null {
  const match = line.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function toISO(day: string, month: string, year: string): string | null {
  const y = year.length === 2 ? `20${year}` : year;
  const d = Number(day);
  const m = Number(month);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function findDate(text: string): string | null {
  const labeled = text.match(/fecha[^\n\d]{0,30}(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i);
  if (labeled) return toISO(labeled[1], labeled[2], labeled[3]);
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return toISO(iso[3], iso[2], iso[1]);
  const any = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})\b/);
  return any ? toISO(any[1], any[2], any[3]) : null;
}

export function extractInvoiceFromText(text: string, options: { excludeTaxIds?: string[] } = {}): TextExtraction {
  const exclude = new Set((options.excludeTaxIds ?? []).map(normalizeTaxId));
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // The first tax id that is not ours belongs to the issuer (supplier).
  const taxIds = [...text.matchAll(EU_VAT_NUMBER), ...text.matchAll(SPANISH_TAX_ID)]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((m) => normalizeTaxId(m[1]))
    .filter((id) => !exclude.has(id) && !exclude.has(id.replace(/^ES/, "")));

  const invoiceNumber =
    text.match(/(?:n[ºo°]\.?\s*(?:de\s+)?factura|factura(?:\s+simplificada)?\s*n[ºo°.]*|invoice\s*(?:no\.?|number|#))\s*[:#]?\s*([A-Z0-9\-/]*\d[A-Z0-9\-/]*)/i)?.[1] ??
    null;

  let baseCents: Cents | null = null;
  let vatRate: number | null = null;
  let vatCents: Cents | null = null;
  let irpfRate: number | null = null;
  let irpfCents: Cents | null = null;
  let totalCents: Cents | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/base\s+imponible|subtotal|importe\s+neto|base\b/.test(lower) && baseCents === null) {
      baseCents = lastAmount(line);
    } else if (/irpf|retenci[oó]n/.test(lower)) {
      irpfRate ??= percentIn(line);
      irpfCents ??= lastAmount(line);
    } else if (/\biva\b|i\.v\.a/.test(lower) && !/sin iva|base/.test(lower)) {
      vatRate ??= percentIn(line);
      vatCents ??= lastAmount(line);
    } else if (/total/.test(lower)) {
      // Keep the last "total" line: it is usually the amount due.
      totalCents = lastAmount(line) ?? totalCents;
    }
  }

  if (irpfCents !== null) irpfCents = Math.abs(irpfCents);

  const supplierName =
    lines.find(
      (l) =>
        /[a-záéíóúñ]{3}/i.test(l) &&
        !/^(factura|invoice|fecha|n[ºo°]|cliente|nif|cif|tel|email|www|p[aá]gina)/i.test(l) &&
        !SPANISH_TAX_ID.test(l),
    ) ?? null;
  SPANISH_TAX_ID.lastIndex = 0;

  return {
    supplierName,
    supplierTaxId: taxIds[0] ?? null,
    invoiceNumber,
    issueDate: findDate(text),
    baseCents,
    vatRate,
    vatCents,
    irpfRate,
    irpfCents,
    totalCents,
  };
}
