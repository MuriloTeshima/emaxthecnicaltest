import { describe, expect, it } from "vitest";
import { type MatchCandidate, bankFingerprint, parseBankCsv, suggestMatches } from "../bank";

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("importación de extractos CSV", () => {
  it("lee el formato habitual con punto y coma e importe con signo", () => {
    const csv = `Fecha;Concepto;Importe;Saldo
16/10/2026;TRANSFERENCIA EMPRESA DEMO SL;1.210,00;5.000,00
17/10/2026;"COMISION MANTENIMIENTO; CUENTA";-12,00;4.988,00`;
    const result = parseBankCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.movements).toEqual([
      { date: date("2026-10-16"), description: "TRANSFERENCIA EMPRESA DEMO SL", amountCents: 121_000 },
      { date: date("2026-10-17"), description: "COMISION MANTENIMIENTO; CUENTA", amountCents: -1_200 },
    ]);
  });

  it("acepta columnas separadas de cargo y abono", () => {
    const csv = "date,description,debit,credit\n2026-10-02,Proveedor,78.65,\n2026-10-03,Cliente,,500.00";
    expect(parseBankCsv(csv).movements.map((m) => m.amountCents)).toEqual([-7_865, 50_000]);
  });

  it("informa de filas no válidas sin abortar la importación", () => {
    const result = parseBankCsv("Fecha;Concepto;Importe\n99/99/2026;X;10\n01/10/2026;Ok;10");
    expect(result.movements).toHaveLength(1);
    expect(result.errors).toEqual(["Fila 2: datos no válidos, se ha omitido."]);
  });

  it("rechaza archivos sin las columnas esperadas", () => {
    expect(parseBankCsv("a;b;c\n1;2;3").errors[0]).toMatch(/columnas/);
  });

  it("genera la misma huella para el mismo movimiento", () => {
    expect(bankFingerprint(date("2026-10-16"), 121_000, " transferencia  empresa demo sl ")).toBe(
      bankFingerprint(date("2026-10-16"), 121_000, "TRANSFERENCIA EMPRESA DEMO SL"),
    );
  });
});

describe("sugerencias de conciliación", () => {
  const candidates: MatchCandidate[] = [
    { kind: "invoice", id: "a", amountCents: 121_000, date: date("2026-10-05"), label: "F2026-0001", reference: "F2026-0001", counterparty: "Empresa Demo SL" },
    { kind: "invoice", id: "b", amountCents: 121_000, date: date("2026-10-15"), label: "F2026-0009", reference: "F2026-0009", counterparty: "Otra Empresa SL" },
    { kind: "expense", id: "c", amountCents: -7_865, date: date("2026-10-12"), label: "Fibra", reference: null, counterparty: "Telefonía Mediterránea SA" },
  ];

  it("solo propone documentos con el mismo importe", () => {
    const result = suggestMatches({ date: date("2026-10-12"), description: "RECIBO TELEFONIA", amountCents: -7_865 }, candidates);
    expect(result.map((r) => r.id)).toEqual(["c"]);
  });

  it("prioriza el nombre del cliente frente a la cercanía de fechas", () => {
    const result = suggestMatches({ date: date("2026-10-16"), description: "TRANSFERENCIA EMPRESA DEMO SL", amountCents: 121_000 }, candidates);
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("el número de factura en el concepto es la señal más fuerte", () => {
    const result = suggestMatches({ date: date("2026-10-06"), description: "PAGO FRA F2026-0009", amountCents: 121_000 }, candidates);
    expect(result[0].id).toBe("b");
  });
});
