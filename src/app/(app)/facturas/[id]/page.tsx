import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AmountRow } from "@/components/amount-row";
import { InvoiceStatusButton } from "@/components/invoices/invoice-status-button";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { lineBaseCents } from "@/domain/invoice";
import { isIntraEu } from "@/domain/rates";
import { countryName, toEuVatNumber } from "@/domain/tax-id";
import { formatDate, formatEUR } from "@/lib/format";
import { getInvoice } from "@/server/queries/invoices";

export const metadata = { title: "Factura" };

export default function InvoicePage({ params }: PageProps<"/facturas/[id]">) {
  return (
    <>
      <Link href="/facturas" className={buttonVariants({ variant: "ghost", size: "sm", className: "mb-4 -ml-2" })}>
        <ArrowLeft />
        Facturas
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <InvoiceDetail params={params} />
      </Suspense>
    </>
  );
}

async function InvoiceDetail({ params }: { params: PageProps<"/facturas/[id]">["params"] }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const intraEu = isIntraEu(invoice.operationType);
  const { contact, totals } = invoice;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{invoice.number}</h1>
            <StatusBadge status={invoice.displayStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Emitida el {formatDate(invoice.issueDate)} · vence el {formatDate(invoice.dueDate)}
            {invoice.paidAt && ` · cobrada el ${formatDate(invoice.paidAt)}`}
          </p>
        </div>
        <InvoiceStatusButton id={invoice.id} status={invoice.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Conceptos</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Concepto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="pr-6 text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.domainLines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6 whitespace-normal">{line.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{line.quantity.toLocaleString("es-ES")}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatEUR(line.unitPriceCents)}</TableCell>
                    <TableCell className="text-right">{intraEu ? "—" : `${line.vatRate}%`}</TableCell>
                    <TableCell className="pr-6 text-right font-mono tabular-nums">{formatEUR(lineBaseCents(line))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {invoice.notes && <p className="px-6 pt-4 text-sm text-muted-foreground">{invoice.notes}</p>}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <p className="font-medium">{contact.name}</p>
              <p className="text-muted-foreground">
                {intraEu ? `NIF-IVA ${toEuVatNumber(contact.country, contact.nif)}` : `NIF ${contact.nif}`}
              </p>
              <p className="text-muted-foreground">{countryName(contact.country)}</p>
              {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Importes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <AmountRow label="Base imponible" value={formatEUR(totals.baseCents)} />
              {totals.breakdown
                .filter((b) => b.vatRate > 0)
                .map((b) => (
                  <AmountRow key={b.vatRate} label={`IVA ${b.vatRate}%`} value={formatEUR(b.vatCents)} />
                ))}
              <Separator className="my-2" />
              <AmountRow label="Total" value={formatEUR(totals.totalCents)} strong />
              {intraEu && (
                <p className="mt-2 rounded-lg bg-primary/5 p-3 text-xs text-primary">
                  Operación intracomunitaria exenta de IVA (inversión del sujeto pasivo). Incluida en el modelo 349.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
