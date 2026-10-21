import { ArrowLeft, Download, FileSignature } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientCard, LinesCard, TotalsCard } from "@/components/invoices/document-parts";
import { InvoiceStatusButton } from "@/components/invoices/invoice-status-button";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isIntraEu } from "@/domain/rates";
import { formatDate } from "@/lib/format";
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
          {invoice.quote && (
            <Link href={`/presupuestos/${invoice.quote.id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <FileSignature className="size-3.5" />
              Desde el presupuesto {invoice.quote.number}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/pdf/factura/${invoice.id}`} className={buttonVariants({ variant: "outline" })}>
            <Download />
            Descargar PDF
          </a>
          <InvoiceStatusButton id={invoice.id} status={invoice.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <LinesCard lines={invoice.domainLines} intraEu={intraEu} notes={invoice.notes} />
        <div className="flex flex-col gap-6">
          <ClientCard contact={invoice.contact} intraEu={intraEu} />
          <TotalsCard totals={invoice.totals} intraEu={intraEu} />
        </div>
      </div>
    </div>
  );
}
