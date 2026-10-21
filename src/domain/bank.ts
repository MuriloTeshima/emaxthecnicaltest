/**
 * Bank statements: CSV parsing and reconciliation suggestions. Amounts are
 * signed cents (positive = money in, negative = money out).
 */
import { type Cents, parseEuros } from "./money";
import { parseISODate } from "./period";

export function bankFingerprint(date: Date, amountCents: Cents, description: string): string {
  const normalized = description.trim().toUpperCase().replace(/\s+/g, " ");
  return `${date.toISOString().slice(0, 10)}|${amountCents}|${normalized}`;
}

export interface ParsedMovement {
  date: Date;
  description: string;
  amountCents: Cents;
}

export interface ParseResult {
  movements: ParsedMovement[];
  errors: string[];
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseDate(value: string): Date | null {
  const iso = parseISODate(value);
  if (iso) return iso;
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return parseISODate(`${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`);
}

const HEADERS = {
  date: /^(fecha( (valor|operaci[oó]n))?|f\. ?valor|date)$/i,
  description: /^(concepto|descripci[oó]n|description|detalle|movimiento)$/i,
  amount: /^(importe|amount|cantidad)$/i,
  debit: /^(cargo|debe|d[eé]bito|debit)$/i,
  credit: /^(abono|haber|cr[eé]dito|credit)$/i,
};

/**
 * Accepts the usual Spanish bank exports: ";" or "," separated, a header row
 * with fecha / concepto / importe (or separate cargo and abono columns).
 */
export function parseBankCsv(text: string): ParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { movements: [], errors: ["El archivo está vacío."] };

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitLine(lines[0], delimiter).map((h) => h.replace(/"/g, ""));
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const dateCol = col(HEADERS.date);
  const descCol = col(HEADERS.description);
  const amountCol = col(HEADERS.amount);
  const debitCol = col(HEADERS.debit);
  const creditCol = col(HEADERS.credit);

  if (dateCol < 0 || descCol < 0 || (amountCol < 0 && debitCol < 0 && creditCol < 0)) {
    return {
      movements: [],
      errors: ["No se reconocen las columnas. Se esperan: fecha, concepto e importe (o cargo y abono)."],
    };
  }

  const movements: ParsedMovement[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitLine(line, delimiter);
    const rowNumber = index + 2;
    const date = parseDate(cells[dateCol] ?? "");
    const description = (cells[descCol] ?? "").trim();
    let amountCents: Cents | null;
    if (amountCol >= 0) {
      amountCents = parseEuros(cells[amountCol] ?? "");
    } else {
      const debit = cells[debitCol]?.trim() ? parseEuros(cells[debitCol]) : 0;
      const credit = cells[creditCol]?.trim() ? parseEuros(cells[creditCol]) : 0;
      amountCents = debit === null || credit === null ? null : credit - Math.abs(debit);
    }
    if (!date || !description || amountCents === null || amountCents === 0) {
      errors.push(`Fila ${rowNumber}: datos no válidos, se ha omitido.`);
      return;
    }
    movements.push({ date, description, amountCents });
  });
  return { movements, errors };
}

export interface MatchCandidate {
  kind: "invoice" | "expense";
  id: string;
  /** Expected signed amount: invoice totals are positive, expense totals negative. */
  amountCents: Cents;
  date: Date;
  label: string;
  reference: string | null;
  counterparty: string;
}

export interface MatchSuggestion extends MatchCandidate {
  score: number;
}

const DAY_MS = 86_400_000;

function words(text: string): Set<string> {
  return new Set(
    text
      .toUpperCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^A-Z0-9]+/)
      .filter((w) => w.length > 2 && !["SL", "SA", "SLU", "TRANSFERENCIA", "TRANSF", "RECIBO", "PAGO"].includes(w)),
  );
}

/**
 * Candidates must match the amount exactly; the date distance, the invoice
 * number and the counterparty name in the description rank them.
 */
export function suggestMatches(
  movement: { date: Date; description: string; amountCents: Cents },
  candidates: MatchCandidate[],
): MatchSuggestion[] {
  const descWords = words(movement.description);
  const upperDesc = movement.description.toUpperCase();

  return candidates
    .filter((c) => Math.abs(c.amountCents - movement.amountCents) <= 1)
    .map((c) => {
      const days = Math.abs(movement.date.getTime() - c.date.getTime()) / DAY_MS;
      let score = Math.max(0, 40 - days); // closer in time is better
      if (c.reference && upperDesc.includes(c.reference.toUpperCase())) score += 50;
      const shared = [...words(c.counterparty)].filter((w) => descWords.has(w)).length;
      score += Math.min(shared, 2) * 20;
      return { ...c, score: Math.round(score) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}
