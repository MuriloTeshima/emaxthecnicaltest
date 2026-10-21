import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { InvoiceStatusButton } from "@/components/invoices/invoice-status-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TableSkeleton } from "@/components/table-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isIntraEu } from "@/domain/rates";
import { sum } from "@/domain/money";
import { param, periodOptions, periodRange } from "@/lib/filters";
import { formatDate, formatEUR } from "@/lib/format";
import { listInvoices } from "@/server/queries/invoices";

export const metadata = { title: "Facturas" };

export default function InvoicesPage({ searchParams }: PageProps<"/facturas">) {
  return (
    <>
      <PageHeader
        title="Facturas"
        description="Facturas emitidas a tus clientes y su estado de cobro."
        actions={
          <Link href="/facturas/nueva" className={buttonVariants({ size: "lg" })}>
            <Plus />
            Nueva factura
          </Link>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <InvoiceList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InvoiceList({ searchParams }: { searchParams: PageProps<"/facturas">["searchParams"] }) {
  const params = await searchParams;
  const values = { q: param(params, "q"), estado: param(params, "estado"), periodo: param(params, "periodo") };
  const filtered = Boolean(values.q || values.estado || values.periodo);
  const invoices = await listInvoices({ q: values.q, status: values.estado, period: periodRange(values.periodo) });

  const filters = (
    <FilterBar
      searchPlaceholder="Cliente, número o concepto"
      values={values}
      selects={[
        {
          name: "estado",
          label: "Estado",
          options: [
            { value: "pendiente", label: "Pendiente" },
            { value: "vencida", label: "Vencida" },
            { value: "cobrada", label: "Cobrada" },
          ],
        },
        { name: "periodo", label: "Periodo", options: periodOptions() },
      ]}
    />
  );

  if (invoices.length === 0 && filtered) {
    return (
      <>
        {filters}
        <EmptyState icon={FileText} title="Sin resultados" description="Ninguna factura coincide con los filtros." />
      </>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Todavía no hay facturas"
        description="Crea la primera y aparecerá aquí y en el resumen."
        action={
          <Link href="/facturas/nueva" className={buttonVariants()}>
            <Plus />
            Nueva factura
          </Link>
        }
      />
    );
  }

  return (
    <>
      {filters}
      <p className="mb-3 text-sm text-muted-foreground">
        {invoices.length} {invoices.length === 1 ? "factura" : "facturas"} · {formatEUR(sum(invoices.map((i) => i.totals.totalCents)))}
      </p>
      {/* Mobile: cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="rounded-xl border p-4">
            <Link href={`/facturas/${invoice.id}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{invoice.contact.name}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.number} · {formatDate(invoice.issueDate)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono font-medium tabular-nums">{formatEUR(invoice.totals.totalCents)}</span>
                <StatusBadge status={invoice.displayStatus} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="pl-4 font-mono text-xs">
                  <Link href={`/facturas/${invoice.id}`} className="hover:underline">
                    {invoice.number}
                  </Link>
                </TableCell>
                <TableCell className="max-w-56">
                  <Link href={`/facturas/${invoice.id}`} className="block truncate font-medium hover:underline">
                    {invoice.contact.name}
                  </Link>
                  {isIntraEu(invoice.operationType) && <span className="text-xs text-muted-foreground">Intracomunitaria</span>}
                </TableCell>
                <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatEUR(invoice.totals.totalCents)}</TableCell>
                <TableCell>
                  <StatusBadge status={invoice.displayStatus} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <InvoiceStatusButton id={invoice.id} status={invoice.status} size="sm" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
