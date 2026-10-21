import { PenLine, Receipt, ScanLine } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { ExpenseStatusButton } from "@/components/expenses/expense-status-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TableSkeleton } from "@/components/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isIntraEu } from "@/domain/rates";
import { formatDate, formatEUR } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/schemas/expense";
import { type ExpenseRow, listExpenses } from "@/server/queries/expenses";

export const metadata = { title: "Gastos" };

const PAID_LABELS = { PAID: "Pagado", PENDING: "Pendiente" } as const;

export default function ExpensesPage() {
  return (
    <>
      <PageHeader
        title="Gastos"
        description="Facturas recibidas y tickets. Sube el PDF o la foto y los datos se rellenan solos."
        actions={
          <>
            <Link href="/gastos/nuevo" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <PenLine />
              Registrar manualmente
            </Link>
            <Link href="/gastos/subir" className={buttonVariants({ size: "lg" })}>
              <ScanLine />
              Subir factura
            </Link>
          </>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <ExpenseList />
      </Suspense>
    </>
  );
}

async function ExpenseList() {
  const expenses = await listExpenses();

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Todavía no hay gastos"
        description="Sube una factura de proveedor y la leeremos por ti."
        action={
          <Link href="/gastos/subir" className={buttonVariants()}>
            <ScanLine />
            Subir factura
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {expenses.map((expense) => (
          <li key={expense.id} className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{expense.supplier.name}</p>
                <p className="truncate text-sm text-muted-foreground">{expense.concept}</p>
                <p className="text-xs text-muted-foreground">{formatDate(expense.date)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono font-medium tabular-nums">{formatEUR(expense.totalCents)}</span>
                <StatusBadge status={expense.status} labels={PAID_LABELS} />
              </div>
            </div>
            <Breakdown expense={expense} />
          </li>
        ))}
      </ul>

      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Fecha</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">IRPF</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="pl-4">{formatDate(expense.date)}</TableCell>
                <TableCell className="max-w-64">
                  <p className="truncate font-medium">{expense.supplier.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {expense.source === "OCR" && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        OCR
                      </Badge>
                    )}
                    {expense.concept}
                    {expense.number && ` · ${expense.number}`}
                  </p>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatEUR(expense.baseCents)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatEUR(expense.vatCents)}
                  <span className="block text-xs text-muted-foreground">
                    {isIntraEu(expense.operationType) ? "ISP" : `${expense.vatRate}%`}
                    {!expense.deductible && " · no deduc."}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {expense.irpfCents > 0 ? `− ${formatEUR(expense.irpfCents)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono font-medium tabular-nums">{formatEUR(expense.totalCents)}</TableCell>
                <TableCell>
                  <StatusBadge status={expense.status} labels={PAID_LABELS} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <ExpenseStatusButton id={expense.id} status={expense.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function Breakdown({ expense }: { expense: ExpenseRow }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {EXPENSE_CATEGORIES[expense.category as keyof typeof EXPENSE_CATEGORIES] ?? expense.category} · Base {formatEUR(expense.baseCents)} · IVA{" "}
        {formatEUR(expense.vatCents)}
        {expense.irpfCents > 0 && ` · IRPF −${formatEUR(expense.irpfCents)}`}
      </span>
      <ExpenseStatusButton id={expense.id} status={expense.status} />
    </div>
  );
}
