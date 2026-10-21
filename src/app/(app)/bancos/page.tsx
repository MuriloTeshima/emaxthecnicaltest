import { CheckCircle2, Wallet } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BankToolbar } from "@/components/bank/bank-toolbar";
import { ReconcileControl, UndoReconciliationButton } from "@/components/bank/movement-actions";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { param } from "@/lib/filters";
import { formatDate, formatEUR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type BankMovementRow, getBankOverview } from "@/server/queries/bank";

export const metadata = { title: "Bancos" };

export default function BankPage({ searchParams }: PageProps<"/bancos">) {
  return (
    <>
      <PageHeader
        title="Bancos"
        description="Importa el extracto de tu banco y relaciona cada movimiento con su factura o gasto."
        actions={<BankToolbar />}
      />
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <Movements searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Movements({ searchParams }: { searchParams: PageProps<"/bancos">["searchParams"] }) {
  const params = await searchParams;
  const estado = param(params, "estado");
  const q = param(params, "q");
  const { movements, summary } = await getBankOverview(estado, q);

  if (summary.total === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sin movimientos bancarios"
        description="Importa un extracto en CSV (fecha, concepto e importe). Puedes probar con el CSV de ejemplo."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Saldo de los movimientos" value={formatEUR(summary.balanceCents)} />
        <SummaryCard label="Por conciliar" value={String(summary.pending)} tone={summary.pending ? "text-amber-600" : undefined} />
        <SummaryCard label="Conciliados" value={String(summary.total - summary.pending)} tone="text-emerald-600" />
      </div>

      <FilterBar
        searchPlaceholder="Buscar por concepto"
        values={{ q, estado }}
        selects={[
          {
            name: "estado",
            label: "Estado",
            options: [
              { value: "pendiente", label: "Por conciliar" },
              { value: "conciliado", label: "Conciliados" },
            ],
          },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="pr-4 text-right">Conciliación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="pl-4 whitespace-nowrap">{formatDate(m.date)}</TableCell>
                <TableCell className="max-w-72 truncate">{m.description}</TableCell>
                <TableCell className={cn("text-right font-mono tabular-nums", m.amountCents > 0 ? "text-emerald-700" : "text-rose-700")}>
                  {m.amountCents > 0 ? "+" : ""}
                  {formatEUR(m.amountCents)}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {m.reconciledAt ? <Reconciled movement={m} /> : <ReconcileControl movementId={m.id} suggestions={m.suggestions} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Al conciliar, la factura queda cobrada (o el gasto pagado) con la fecha del movimiento. Las sugerencias exigen el mismo importe y se
        ordenan por número de factura en el concepto, nombre del contacto y cercanía de fechas.
      </p>
    </div>
  );
}

function Reconciled({ movement }: { movement: BankMovementRow }) {
  const link = movement.invoice
    ? { href: `/facturas/${movement.invoice.id}`, label: `Factura ${movement.invoice.number}`, who: movement.invoice.contact.name }
    : movement.expense
      ? { href: "/gastos", label: movement.expense.number ? `Gasto ${movement.expense.number}` : movement.expense.concept, who: movement.expense.supplier.name }
      : null;
  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
      {link ? (
        <Link href={link.href} className="max-w-56 truncate hover:underline">
          <span className="font-medium">{link.label}</span>
          <span className="text-muted-foreground"> · {link.who}</span>
        </Link>
      ) : (
        <span className="text-muted-foreground">Conciliado</span>
      )}
      <UndoReconciliationButton movementId={movement.id} />
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
        <span className={cn("font-mono text-base font-semibold tabular-nums sm:text-xl", tone)}>{value}</span>
      </CardContent>
    </Card>
  );
}
