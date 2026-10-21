import { describe, expect, it } from "vitest";
import { checkExpenseConsistency, expenseAmounts, inferRate } from "../expense";
import { formatInvoiceNumber, invoiceTotals, lineBaseCents, nextInvoiceSequence } from "../invoice";
import { formatEUR, parseEuros, percentOf } from "../money";
import { isInPeriod, parseISODate, quarterOf } from "../period";
import { isValidSpanishTaxId, toEuVatNumber } from "../tax-id";
import { type TaxExpense, type TaxInvoice, computeModel111, computeModel303, computeModel349 } from "../taxes";

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Test cases from the brief (section 6)
const caseA: TaxInvoice = {
  id: "inv-a",
  number: "F2026-0001",
  issueDate: date("2026-10-05"),
  operationType: "DOMESTIC",
  contact: { name: "Empresa Demo SL", nif: "B12345674", country: "ES" },
  lines: [{ description: "Consultoría", quantity: 1, unitPriceCents: 100_000, vatRate: 21 }],
};

const caseBAmounts = expenseAmounts({ baseCents: 100_000, vatRate: 21, irpfRate: 15 });
const caseB: TaxExpense = {
  id: "exp-b",
  number: "P-17",
  date: date("2026-10-08"),
  operationType: "DOMESTIC",
  deductible: true,
  vatRate: 21,
  irpfRate: 15,
  ...caseBAmounts,
  supplier: { id: "sup-1", name: "Asesoría Fiscal López", nif: "12345678Z", country: "ES" },
};

const caseC: TaxInvoice = {
  id: "inv-c",
  number: "F2026-0002",
  issueDate: date("2026-10-12"),
  operationType: "EU_SERVICES",
  contact: { name: "Müller Software GmbH", nif: "123456789", country: "DE" },
  lines: [{ description: "Desarrollo a medida", quantity: 1, unitPriceCents: 200_000, vatRate: 21 }],
};

describe("Caso A — factura emitida", () => {
  it("calcula base 1.000 €, IVA 210 € y total 1.210 €", () => {
    const totals = invoiceTotals(caseA.lines);
    expect(totals).toMatchObject({ baseCents: 100_000, vatCents: 21_000, totalCents: 121_000 });
  });

  it("aporta 210 € de IVA repercutido al 303", () => {
    const m303 = computeModel303([caseA], []);
    expect(m303.accruedVatCents).toBe(21_000);
    expect(m303.resultCents).toBe(21_000);
  });
});

describe("Caso B — factura recibida con IRPF", () => {
  it("total a pagar 1.060 € (1.000 + 210 − 150)", () => {
    expect(caseBAmounts).toEqual({ baseCents: 100_000, vatCents: 21_000, irpfCents: 15_000, totalCents: 106_000 });
  });

  it("identifica 210 € de IVA soportado en el 303", () => {
    const m303 = computeModel303([], [caseB]);
    expect(m303.deductibleVatCents).toBe(21_000);
    expect(m303.resultCents).toBe(-21_000);
  });

  it("identifica 150 € retenidos en el 111", () => {
    const m111 = computeModel111([caseB]);
    expect(m111).toMatchObject({ recipients: 1, baseCents: 100_000, withheldCents: 15_000 });
  });

  it("con A y B en el mismo trimestre el 303 sale a 0", () => {
    expect(computeModel303([caseA], [caseB]).resultCents).toBe(0);
  });

  it("no cuenta IVA de gastos no deducibles", () => {
    const m303 = computeModel303([], [{ ...caseB, deductible: false }]);
    expect(m303.deductibleVatCents).toBe(0);
  });
});

describe("Caso C — operación intracomunitaria", () => {
  it("se factura sin IVA (inversión del sujeto pasivo)", () => {
    expect(invoiceTotals(caseC.lines, "EU_SERVICES")).toMatchObject({ vatCents: 0, totalCents: 200_000 });
  });

  it("aparece en el 349 con operador, clave S e importe", () => {
    const m349 = computeModel349([caseA, caseC], [caseB]);
    expect(m349.rows).toEqual([
      { vatNumber: "DE123456789", name: "Müller Software GmbH", country: "DE", key: "S", baseCents: 200_000, documents: 1 },
    ]);
    expect(m349.operators).toBe(1);
  });

  it("no altera la cuota del 303, solo la informa", () => {
    const m303 = computeModel303([caseC], []);
    expect(m303.accruedVatCents).toBe(0);
    expect(m303.intraEuSuppliesBaseCents).toBe(200_000);
  });

  it("agrupa por operador y clave", () => {
    const second = { ...caseC, id: "inv-c2", lines: [{ ...caseC.lines[0], unitPriceCents: 50_000 }] };
    const goods = { ...caseC, id: "inv-c3", operationType: "EU_GOODS" as const };
    const m349 = computeModel349([caseC, second, goods], []);
    expect(m349.rows.map((r) => [r.key, r.baseCents, r.documents])).toEqual([
      ["E", 200_000, 1],
      ["S", 250_000, 2],
    ]);
  });

  it("adquisición intracomunitaria: autorrepercusión neutra en el 303 y clave I en el 349", () => {
    const amounts = expenseAmounts({ baseCents: 50_000, vatRate: 21, irpfRate: 0, operationType: "EU_SERVICES" });
    const purchase: TaxExpense = {
      ...caseB,
      id: "exp-eu",
      operationType: "EU_SERVICES",
      irpfRate: 0,
      ...amounts,
      supplier: { id: "sup-fr", name: "Logiciel SARL", nif: "FR12345678901", country: "FR" },
    };
    expect(amounts.totalCents).toBe(50_000);
    expect(computeModel303([], [purchase]).resultCents).toBe(0);
    expect(computeModel349([], [purchase]).rows[0]).toMatchObject({ key: "I", vatNumber: "FR12345678901" });
  });
});

describe("cálculos de factura", () => {
  it("agrupa el IVA por tipo", () => {
    const totals = invoiceTotals([
      { description: "a", quantity: 2, unitPriceCents: 1_000, vatRate: 21 },
      { description: "b", quantity: 1, unitPriceCents: 500, vatRate: 10 },
      { description: "c", quantity: 1, unitPriceCents: 1_000, vatRate: 21 },
    ]);
    expect(totals.breakdown).toEqual([
      { vatRate: 21, baseCents: 3_000, vatCents: 630 },
      { vatRate: 10, baseCents: 500, vatCents: 50 },
    ]);
    expect(totals.totalCents).toBe(4_180);
  });

  it("evita errores de coma flotante en cantidades decimales", () => {
    expect(lineBaseCents({ quantity: 0.1, unitPriceCents: 3 * 1_000 })).toBe(300);
    expect(lineBaseCents({ quantity: 1.5, unitPriceCents: 1_999 })).toBe(2_999); // 2998.5 → half-up
  });

  it("numera de forma correlativa por serie y año", () => {
    expect(formatInvoiceNumber("F", 2026, 7)).toBe("F2026-0007");
    expect(nextInvoiceSequence(["F2026-0001", "F2026-0009", "F2025-0040"], "F", 2026)).toBe(10);
    expect(nextInvoiceSequence([], "F", 2026)).toBe(1);
  });
});

describe("dinero", () => {
  it("redondea porcentajes half-up", () => {
    expect(percentOf(1_005, 10)).toBe(101); // 100.5 → 101
    expect(percentOf(333, 21)).toBe(70); // 69.93 → 70
  });

  it("interpreta importes en formato español e internacional", () => {
    expect(parseEuros("1.210,50")).toBe(121_050);
    expect(parseEuros("1210.50")).toBe(121_050);
    expect(parseEuros("1,210.50")).toBe(121_050);
    expect(parseEuros("1.060 €")).toBe(106_000);
    expect(parseEuros("abc")).toBeNull();
  });

  it("formatea en euros", () => {
    expect(formatEUR(121_000).replace(/\s/g, " ")).toBe("1.210,00 €");
  });
});

describe("validación OCR", () => {
  it("acepta importes coherentes", () => {
    expect(checkExpenseConsistency({ baseCents: 100_000, vatRate: 21, vatCents: 21_000, irpfRate: 15, irpfCents: 15_000, totalCents: 106_000 })).toEqual([]);
  });

  it("detecta un total que no cuadra", () => {
    const warnings = checkExpenseConsistency({ baseCents: 100_000, vatCents: 21_000, irpfCents: 15_000, totalCents: 121_000 });
    expect(warnings.map((w) => w.field)).toEqual(["totalCents"]);
  });

  it("infiere el tipo a partir de los importes", () => {
    expect(inferRate(100_000, 21_000, [21, 10, 4])).toBe(21);
    expect(inferRate(100_000, 15_000, [15, 7])).toBe(15);
    expect(inferRate(100_000, 12_345, [21, 10, 4])).toBeNull();
  });
});

describe("periodos e identificadores", () => {
  it("asigna trimestres en UTC", () => {
    expect(quarterOf(date("2026-03-31"))).toEqual({ year: 2026, quarter: 1 });
    expect(quarterOf(date("2026-10-01"))).toEqual({ year: 2026, quarter: 4 });
    expect(isInPeriod(date("2026-12-31"), { year: 2026, quarter: 4 })).toBe(true);
    expect(isInPeriod(date("2027-01-01"), { year: 2026, quarter: 4 })).toBe(false);
  });

  it("rechaza fechas imposibles en lugar de desplazarlas", () => {
    expect(parseISODate("2026-02-31")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("2028-02-29")).toEqual(date("2028-02-29"));
  });

  it("valida NIF, NIE y CIF", () => {
    expect(isValidSpanishTaxId("12345678Z")).toBe(true);
    expect(isValidSpanishTaxId("12345678A")).toBe(false);
    expect(isValidSpanishTaxId("X1234567L")).toBe(true);
    expect(isValidSpanishTaxId("B12345674")).toBe(true);
    expect(isValidSpanishTaxId("B12345675")).toBe(false);
  });

  it("construye el NIF-IVA con prefijo de país", () => {
    expect(toEuVatNumber("DE", "123 456 789")).toBe("DE123456789");
    expect(toEuVatNumber("DE", "DE123456789")).toBe("DE123456789");
    expect(toEuVatNumber("GR", "123456789")).toBe("EL123456789");
  });
});
