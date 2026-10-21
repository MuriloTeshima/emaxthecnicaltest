import { isIntraEu } from "@/domain/rates";
import { getCompany } from "@/server/company";
import { renderSalesDocumentPdf } from "@/server/pdf/sales-document-pdf";
import { getInvoice } from "@/server/queries/invoices";
import { getQuote } from "@/server/queries/quotes";

export async function GET(_request: Request, { params }: RouteContext<"/api/pdf/[kind]/[id]">) {
  const { kind, id } = await params;
  if (kind !== "factura" && kind !== "presupuesto") return new Response("Documento no encontrado", { status: 404 });

  const [company, document] = await Promise.all([getCompany(), kind === "factura" ? getInvoice(id) : getQuote(id)]);
  if (!document) return new Response("Documento no encontrado", { status: 404 });

  const pdf = await renderSalesDocumentPdf({
    kind: kind === "factura" ? "invoice" : "quote",
    number: document.number,
    issueDate: document.issueDate,
    endDate: "dueDate" in document ? document.dueDate : document.validUntil,
    intraEu: isIntraEu(document.operationType),
    notes: document.notes,
    company,
    contact: document.contact,
    lines: document.domainLines,
    totals: document.totals,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${kind}-${document.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
