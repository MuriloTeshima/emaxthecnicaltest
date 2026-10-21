import "server-only";
import { type PDFFont, type PDFPage, PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { type InvoiceLineInput, type InvoiceTotals, lineBaseCents } from "@/domain/invoice";
import { countryName, toEuVatNumber } from "@/domain/tax-id";
import { formatDate, formatEUR } from "@/lib/format";

export interface SalesDocumentPdfInput {
  kind: "invoice" | "quote";
  number: string;
  issueDate: Date;
  /** Due date (invoice) or end of validity (quote). */
  endDate: Date;
  intraEu: boolean;
  notes: string | null;
  company: { name: string; nif: string; address: string | null; email: string | null; phone: string | null; iban: string | null };
  contact: { name: string; nif: string; country: string; address: string | null; email: string | null };
  lines: InvoiceLineInput[];
  totals: InvoiceTotals;
}

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.12, 0.13, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const BRAND = rgb(0.15, 0.39, 0.92);
const RULE = rgb(0.88, 0.89, 0.91);

export async function renderSalesDocumentPdf(doc: SalesDocumentPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const title = doc.kind === "invoice" ? "FACTURA" : "PRESUPUESTO";
  pdf.setTitle(`${title} ${doc.number}`);
  pdf.setAuthor(doc.company.name);
  pdf.setCreator("EnerFactura");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // Standard PDF fonts only cover WinAnsi (Latin-1 plus €); replace anything else.
  const supported = new Set(regular.getCharacterSet());
  const safe = (text: string) =>
    [...text.replace(/ /g, " ")].map((c) => (supported.has(c.codePointAt(0)!) ? c : "?")).join("");

  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;

  const text = (t: string, x: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; p?: PDFPage } = {}) =>
    (opts.p ?? page).drawText(safe(t), { x, y: yy, font: opts.font ?? regular, size: opts.size ?? 9.5, color: opts.color ?? INK });
  const textRight = (t: string, right: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 9.5;
    text(t, right - font.widthOfTextAtSize(safe(t), size), yy, { ...opts, font, size });
  };
  const wrap = (t: string, width: number, font: PDFFont, size: number) => {
    const lines: string[] = [];
    for (const paragraph of safe(t).split("\n")) {
      let current = "";
      for (const word of paragraph.split(" ")) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > width && current) {
          lines.push(current);
          current = word;
        } else current = candidate;
      }
      lines.push(current);
    }
    return lines;
  };
  const right = A4.width - MARGIN;

  // Header: issuer on the left, document data on the right.
  text(doc.company.name, MARGIN, y, { font: bold, size: 16 });
  textRight(title, right, y, { font: bold, size: 16, color: BRAND });
  y -= 18;
  const issuer = [`NIF ${doc.company.nif}`, doc.company.address, [doc.company.email, doc.company.phone].filter(Boolean).join(" · ")].filter(Boolean) as string[];
  const meta: [string, string][] = [
    ["Número", doc.number],
    ["Fecha", formatDate(doc.issueDate)],
    [doc.kind === "invoice" ? "Vencimiento" : "Válido hasta", formatDate(doc.endDate)],
  ];
  for (let i = 0; i < Math.max(issuer.length, meta.length); i++) {
    if (issuer[i]) text(issuer[i], MARGIN, y, { color: MUTED });
    if (meta[i]) {
      textRight(meta[i][1], right, y, { font: bold });
      textRight(`${meta[i][0]}:`, right - 90, y, { color: MUTED });
    }
    y -= 13;
  }

  // Client box.
  y -= 14;
  const contactLines = [
    doc.contact.name,
    doc.intraEu ? `NIF-IVA ${toEuVatNumber(doc.contact.country, doc.contact.nif)}` : `NIF ${doc.contact.nif}`,
    doc.contact.address,
    countryName(doc.contact.country),
  ].filter(Boolean) as string[];
  const boxHeight = 22 + contactLines.length * 13;
  page.drawRectangle({ x: MARGIN, y: y - boxHeight + 10, width: 260, height: boxHeight, color: rgb(0.97, 0.97, 0.98) });
  text("CLIENTE", MARGIN + 10, y - 4, { font: bold, size: 8, color: MUTED });
  let cy = y - 18;
  contactLines.forEach((line, i) => {
    text(line, MARGIN + 10, cy, { font: i === 0 ? bold : regular });
    cy -= 13;
  });
  y -= boxHeight + 18;

  // Lines table.
  const cols = { qty: right - 205, price: right - 140, vat: right - 85, amount: right };
  const descWidth = cols.qty - MARGIN - 40;
  const header = () => {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: right - MARGIN, height: 20, color: rgb(0.95, 0.96, 0.98) });
    text("Concepto", MARGIN + 6, y, { font: bold, size: 8.5 });
    textRight("Cant.", cols.qty, y, { font: bold, size: 8.5 });
    textRight("Precio", cols.price, y, { font: bold, size: 8.5 });
    textRight("IVA", cols.vat, y, { font: bold, size: 8.5 });
    textRight("Importe", cols.amount - 6, y, { font: bold, size: 8.5 });
    y -= 22;
  };
  header();
  for (const line of doc.lines) {
    const descLines = wrap(line.description, descWidth, regular, 9.5);
    const rowHeight = descLines.length * 12 + 8;
    if (y - rowHeight < MARGIN + 140) {
      page = pdf.addPage([A4.width, A4.height]);
      y = A4.height - MARGIN;
      header();
    }
    descLines.forEach((d, i) => text(d, MARGIN + 6, y - i * 12));
    textRight(line.quantity.toLocaleString("es-ES"), cols.qty, y);
    textRight(formatEUR(line.unitPriceCents), cols.price, y);
    textRight(doc.intraEu ? "-" : `${line.vatRate}%`, cols.vat, y);
    textRight(formatEUR(lineBaseCents(line)), cols.amount - 6, y);
    y -= rowHeight;
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.5, color: RULE });
  }

  // Totals.
  y -= 10;
  const totalsX = right - 200;
  const totalRow = (label: string, value: string, strong = false) => {
    text(label, totalsX, y, { font: strong ? bold : regular, size: strong ? 11 : 9.5, color: strong ? INK : MUTED });
    textRight(value, right - 6, y, { font: strong ? bold : regular, size: strong ? 11 : 9.5 });
    y -= strong ? 18 : 14;
  };
  totalRow("Base imponible", formatEUR(doc.totals.baseCents));
  for (const b of doc.totals.breakdown.filter((b) => b.vatRate > 0)) totalRow(`IVA ${b.vatRate}%`, formatEUR(b.vatCents));
  page.drawLine({ start: { x: totalsX, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 1, color: INK });
  y -= 4;
  totalRow("TOTAL", formatEUR(doc.totals.totalCents), true);

  // Legal note, payment details and notes.
  y -= 12;
  const footerNotes: string[] = [];
  if (doc.intraEu) footerNotes.push("Operación intracomunitaria exenta de IVA (art. 25 Ley 37/1992). Inversión del sujeto pasivo.");
  if (doc.kind === "invoice" && doc.company.iban) footerNotes.push(`Forma de pago: transferencia bancaria a ${doc.company.iban}.`);
  if (doc.notes) footerNotes.push(doc.notes);
  for (const note of footerNotes) {
    for (const l of wrap(note, right - MARGIN, regular, 8.5)) {
      text(l, MARGIN, y, { size: 8.5, color: MUTED });
      y -= 12;
    }
    y -= 4;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    text(`${doc.company.name} · ${title} ${doc.number} · Página ${i + 1} de ${pages.length}`, MARGIN, 28, { size: 7.5, color: MUTED, p }),
  );

  return pdf.save();
}
