/**
 * Fictitious demo data. Shared by the CLI seed and the in-app
 * "Restablecer datos demo" action. Includes the brief's test cases A, B, C.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { expenseAmounts } from "@/domain/expense";
import { formatInvoiceNumber } from "@/domain/invoice";
import { addDays, quarterOf, todayUTC } from "@/domain/period";

export const DEMO_COMPANY = {
  name: "Energía Solar Levante SL",
  nif: "B98765431",
  address: "Calle Colón 12, 46004 Valencia",
  invoiceSeries: "F",
};

export async function resetDemoData(db: PrismaClient): Promise<string> {
  const today = todayUTC();
  const { year, quarter } = quarterOf(today);
  // Dates inside the current quarter so the tax pages show them by default.
  const quarterStart = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
  const day = (offset: number) => {
    const d = addDays(quarterStart, offset);
    return d > today ? today : d;
  };

  return db.$transaction(async (tx) => {
    await tx.company.deleteMany();
    const company = await tx.company.create({ data: DEMO_COMPANY });
    const companyId = company.id;

    const [demoClient, germanClient, retailClient, advisor, telecom, designer] = await Promise.all([
      tx.contact.create({ data: { companyId, kind: "CLIENT", name: "Empresa Demo SL", nif: "B12345674", country: "ES", email: "admin@empresademo.example" } }),
      tx.contact.create({ data: { companyId, kind: "CLIENT", name: "Müller Software GmbH", nif: "DE123456789", country: "DE", email: "billing@mueller.example" } }),
      tx.contact.create({ data: { companyId, kind: "CLIENT", name: "Comercial Turia SL", nif: "B46000006", country: "ES" } }),
      tx.contact.create({ data: { companyId, kind: "SUPPLIER", name: "Asesoría Fiscal López", nif: "12345678Z", country: "ES", isProfessional: true } }),
      tx.contact.create({ data: { companyId, kind: "SUPPLIER", name: "Telefonía Mediterránea SA", nif: "A28000008", country: "ES" } }),
      tx.contact.create({ data: { companyId, kind: "SUPPLIER", name: "Laura Gómez Diseño", nif: "X1234567L", country: "ES", isProfessional: true } }),
    ]);

    const invoice = (seq: number, data: {
      contactId: string;
      issueDate: Date;
      operationType?: "DOMESTIC" | "EU_GOODS" | "EU_SERVICES";
      status?: "PENDING" | "PAID";
      lines: { description: string; quantity: number; unitPriceCents: number; vatRate: number }[];
    }) =>
      tx.invoice.create({
        data: {
          companyId,
          contactId: data.contactId,
          number: formatInvoiceNumber(DEMO_COMPANY.invoiceSeries, year, seq),
          issueDate: data.issueDate,
          dueDate: addDays(data.issueDate, 30),
          operationType: data.operationType ?? "DOMESTIC",
          status: data.status ?? "PENDING",
          paidAt: data.status === "PAID" ? addDays(data.issueDate, 10) : null,
          lines: { create: data.lines.map((l, position) => ({ ...l, position })) },
        },
      });

    // Caso A: 1.000 € + 21% IVA = 1.210 €
    await invoice(1, {
      contactId: demoClient.id,
      issueDate: day(4),
      lines: [{ description: "Estudio de eficiencia energética", quantity: 1, unitPriceCents: 100_000, vatRate: 21 }],
    });
    // Caso C: prestación intracomunitaria de servicios a Alemania, 2.000 €
    await invoice(2, {
      contactId: germanClient.id,
      issueDate: day(9),
      operationType: "EU_SERVICES",
      status: "PAID",
      lines: [{ description: "Consultoría técnica para instalación fotovoltaica", quantity: 1, unitPriceCents: 200_000, vatRate: 0 }],
    });
    await invoice(3, {
      contactId: retailClient.id,
      issueDate: day(15),
      status: "PAID",
      lines: [
        { description: "Mantenimiento placas solares", quantity: 4, unitPriceCents: 9_000, vatRate: 21 },
        { description: "Desplazamiento", quantity: 1, unitPriceCents: 3_500, vatRate: 21 },
      ],
    });

    const expense = (data: {
      supplierId: string;
      date: Date;
      number: string;
      concept: string;
      category: string;
      baseCents: number;
      vatRate: number;
      irpfRate?: number;
      status?: "PENDING" | "PAID";
    }) => {
      const irpfRate = data.irpfRate ?? 0;
      const amounts = expenseAmounts({ baseCents: data.baseCents, vatRate: data.vatRate, irpfRate });
      return tx.expense.create({
        data: {
          companyId,
          supplierId: data.supplierId,
          number: data.number,
          date: data.date,
          concept: data.concept,
          category: data.category,
          vatRate: data.vatRate,
          irpfRate,
          ...amounts,
          status: data.status ?? "PENDING",
          paidAt: data.status === "PAID" ? data.date : null,
        },
      });
    };

    // Caso B: 1.000 € + 21% IVA − 15% IRPF = 1.060 €
    await expense({
      supplierId: advisor.id,
      date: day(6),
      number: "AFL-2026-118",
      concept: "Asesoría fiscal y contable trimestral",
      category: "servicios-profesionales",
      baseCents: 100_000,
      vatRate: 21,
      irpfRate: 15,
    });
    await expense({
      supplierId: telecom.id,
      date: day(12),
      number: "TM-884213",
      concept: "Fibra y móvil",
      category: "suministros",
      baseCents: 6_500,
      vatRate: 21,
      status: "PAID",
    });
    await expense({
      supplierId: designer.id,
      date: day(18),
      number: "LG-031",
      concept: "Diseño de catálogo comercial",
      category: "servicios-profesionales",
      baseCents: 45_000,
      vatRate: 21,
      irpfRate: 15,
      status: "PAID",
    });

    return companyId;
  });
}
