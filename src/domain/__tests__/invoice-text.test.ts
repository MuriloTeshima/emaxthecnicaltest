import { describe, expect, it } from "vitest";
import { extractInvoiceFromText } from "../invoice-text";

const SAMPLE = `
Asesoría Fiscal López
NIF: 12345678-Z
C/ Mayor 1, 46001 Valencia

FACTURA Nº AFL-2026-118
Fecha de factura: 06/10/2026

Cliente: Energía Solar Levante SL
CIF: B98765431

Concepto                                   Importe
Asesoría fiscal y contable trimestral      1.000,00 €

Base imponible                             1.000,00 €
IVA 21%                                      210,00 €
Retención IRPF 15%                          -150,00 €
TOTAL A PAGAR                              1.060,00 €
`;

describe("extracción de facturas desde texto", () => {
  it("extrae los campos de una factura de profesional (caso B)", () => {
    const result = extractInvoiceFromText(SAMPLE, { excludeTaxIds: ["B98765431"] });
    expect(result).toEqual({
      supplierName: "Asesoría Fiscal López",
      supplierTaxId: "12345678Z",
      invoiceNumber: "AFL-2026-118",
      issueDate: "2026-10-06",
      baseCents: 100_000,
      vatRate: 21,
      vatCents: 21_000,
      irpfRate: 15,
      irpfCents: 15_000,
      totalCents: 106_000,
    });
  });

  it("ignora la palabra 'factura' al buscar el número", () => {
    expect(extractInvoiceFromText("FACTURA Nº factura: MR-2026-042").invoiceNumber).toBe("MR-2026-042");
    expect(extractInvoiceFromText("Factura simplificada nº: T-778812").invoiceNumber).toBe("T-778812");
  });

  it("no confunde el NIF del cliente con el del proveedor", () => {
    const result = extractInvoiceFromText("Cliente CIF B98765431\nProveedor CIF A28000008", { excludeTaxIds: ["B98765431"] });
    expect(result.supplierTaxId).toBe("A28000008");
  });

  it("reconoce NIF-IVA europeos y fechas ISO", () => {
    const result = extractInvoiceFromText("Logiciel SARL\nVAT FR12345678901\nDate 2026-10-02\nTotal 500.00");
    expect(result).toMatchObject({ supplierTaxId: "FR12345678901", issueDate: "2026-10-02", totalCents: 50_000 });
  });

  it("deja en null lo que no encuentra", () => {
    const result = extractInvoiceFromText("Texto sin datos de factura");
    expect(result).toMatchObject({ baseCents: null, vatRate: null, totalCents: null, supplierTaxId: null });
  });
});
