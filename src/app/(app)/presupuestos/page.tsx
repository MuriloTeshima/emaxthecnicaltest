import { FileSignature, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { TableSkeleton } from "@/components/table-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatEUR } from "@/lib/format";
import { listQuotes } from "@/server/queries/quotes";

export const metadata = { title: "Presupuestos" };

export default function QuotesPage() {
  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Propuestas a clientes. Cuando las aceptan, se convierten en factura con un clic."
        actions={
          <Link href="/presupuestos/nuevo" className={buttonVariants({ size: "lg" })}>
            <Plus />
            Nuevo presupuesto
          </Link>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <QuoteList />
      </Suspense>
    </>
  );
}

async function QuoteList() {
  const quotes = await listQuotes();
  if (quotes.length === 0) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Todavía no hay presupuestos"
        description="Crea uno y conviértelo en factura cuando el cliente lo acepte."
        action={
          <Link href="/presupuestos/nuevo" className={buttonVariants()}>
            <Plus />
            Nuevo presupuesto
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {quotes.map((quote) => (
          <li key={quote.id} className="rounded-xl border p-4">
            <Link href={`/presupuestos/${quote.id}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{quote.contact.name}</p>
                <p className="text-sm text-muted-foreground">
                  {quote.number} · {formatDate(quote.issueDate)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono font-medium tabular-nums">{formatEUR(quote.totals.totalCents)}</span>
                <QuoteStatusBadge status={quote.status} expired={quote.expired} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Válido hasta</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="pr-4">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow key={quote.id}>
                <TableCell className="pl-4 font-mono text-xs">
                  <Link href={`/presupuestos/${quote.id}`} className="hover:underline">
                    {quote.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/presupuestos/${quote.id}`} className="font-medium hover:underline">
                    {quote.contact.name}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(quote.issueDate)}</TableCell>
                <TableCell>{formatDate(quote.validUntil)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatEUR(quote.totals.totalCents)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center gap-2">
                    <QuoteStatusBadge status={quote.status} expired={quote.expired} />
                    {quote.invoice && (
                      <Link href={`/facturas/${quote.invoice.id}`} className="font-mono text-xs text-primary hover:underline">
                        {quote.invoice.number}
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
