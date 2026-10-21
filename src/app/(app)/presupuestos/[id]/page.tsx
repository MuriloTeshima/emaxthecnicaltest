import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientCard, LinesCard, TotalsCard } from "@/components/invoices/document-parts";
import { QuoteActions } from "@/components/quotes/quote-actions";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isIntraEu } from "@/domain/rates";
import { formatDate } from "@/lib/format";
import { getQuote } from "@/server/queries/quotes";

export const metadata = { title: "Presupuesto" };

export default function QuotePage({ params }: PageProps<"/presupuestos/[id]">) {
  return (
    <>
      <Link href="/presupuestos" className={buttonVariants({ variant: "ghost", size: "sm", className: "mb-4 -ml-2" })}>
        <ArrowLeft />
        Presupuestos
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <QuoteDetail params={params} />
      </Suspense>
    </>
  );
}

async function QuoteDetail({ params }: { params: PageProps<"/presupuestos/[id]">["params"] }) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();
  const intraEu = isIntraEu(quote.operationType);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{quote.number}</h1>
            <QuoteStatusBadge status={quote.status} expired={quote.expired} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Emitido el {formatDate(quote.issueDate)} · válido hasta el {formatDate(quote.validUntil)}
          </p>
          {quote.invoice && (
            <Link href={`/facturas/${quote.invoice.id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <FileText className="size-3.5" />
              Facturado en {quote.invoice.number}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/pdf/presupuesto/${quote.id}`} className={buttonVariants({ variant: "outline" })}>
            <Download />
            Descargar PDF
          </a>
          <QuoteActions id={quote.id} status={quote.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <LinesCard lines={quote.domainLines} intraEu={intraEu} notes={quote.notes} />
        <div className="flex flex-col gap-6">
          <ClientCard contact={quote.contact} intraEu={intraEu} />
          <TotalsCard totals={quote.totals} intraEu={intraEu} />
        </div>
      </div>
    </div>
  );
}
