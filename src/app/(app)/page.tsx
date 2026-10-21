import { ArrowDownRight, ArrowUpRight, Clock, FileText, Landmark, Plus, Receipt, ScanLine, Scale } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PeriodSelect } from "@/components/period-select";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriod, parsePeriodParam, periodToParam, quarterOf, todayUTC } from "@/domain/period";
import { formatDate, formatEUR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDashboard } from "@/server/queries/ledger";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader
        title="Inicio"
        description="Cómo va tu negocio este trimestre."
        actions={
          <>
            <Link href="/gastos/subir" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <ScanLine />
              Subir gasto
            </Link>
            <Link href="/facturas/nueva" className={buttonVariants({ size: "lg" })}>
              <Plus />
              Nueva factura
            </Link>
          </>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  await connection(); // "today" must be computed per request
  const current = quarterOf(todayUTC());
  const period = parsePeriodParam(typeof params.periodo === "string" ? params.periodo : undefined, current);
  const data = await getDashboard(period);
  const maxMonth = Math.max(1, ...data.months.map((m) => Math.max(m.incomeCents, m.expenseCents)));
  const quarterMonths = [0, 1, 2].map((i) => (period.quarter - 1) * 3 + i);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Importes sin IVA del <strong className="text-foreground">{formatPeriod(period)}</strong>
        </p>
        <PeriodSelect value={period} current={current} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ingresos" value={formatEUR(data.incomeCents)} icon={ArrowUpRight} tone="text-emerald-600" href="/facturas" />
        <Kpi label="Gastos" value={formatEUR(data.expenseCents)} icon={ArrowDownRight} tone="text-rose-600" href="/gastos" />
        <Kpi
          label="Balance"
          value={formatEUR(data.balanceCents)}
          icon={Scale}
          tone={data.balanceCents >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <Kpi
          label="Pendiente de cobro"
          value={formatEUR(data.pendingCents)}
          icon={Clock}
          tone="text-amber-600"
          href="/facturas"
          footnote={
            data.pendingCount === 0
              ? "Todo cobrado"
              : `${data.pendingCount} ${data.pendingCount === 1 ? "factura" : "facturas"}${data.overdueCount ? ` · ${data.overdueCount} vencida${data.overdueCount > 1 ? "s" : ""}` : ""}`
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Evolución {period.year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label="Ingresos y gastos por mes">
              {data.months.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-36 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 max-w-3 rounded-t bg-primary"
                      style={{ height: `${(m.incomeCents / maxMonth) * 100}%` }}
                      title={`Ingresos ${MONTHS[m.month]}: ${formatEUR(m.incomeCents)}`}
                    />
                    <div
                      className="w-1/2 max-w-3 rounded-t bg-rose-300"
                      style={{ height: `${(m.expenseCents / maxMonth) * 100}%` }}
                      title={`Gastos ${MONTHS[m.month]}: ${formatEUR(m.expenseCents)}`}
                    />
                  </div>
                  <span className={cn("text-[10px] text-muted-foreground", quarterMonths.includes(m.month) && "font-semibold text-foreground")}>
                    {MONTHS[m.month]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary" /> Ingresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-rose-300" /> Gastos
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impuestos del trimestre</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <TaxLine
              label="IVA (modelo 303)"
              value={formatEUR(Math.abs(data.vatResultCents))}
              hint={data.vatResultCents > 0 ? "A ingresar" : data.vatResultCents < 0 ? "A compensar" : "Sin cuota"}
            />
            <TaxLine label="Retenciones IRPF (modelo 111)" value={formatEUR(data.withheldCents)} hint="A ingresar" />
            <Link href={`/impuestos?periodo=${periodToParam(period)}`} className={buttonVariants({ variant: "outline" })}>
              <Landmark />
              Ver detalle
            </Link>
            <p className="text-xs text-muted-foreground">Estimación orientativa, no es una declaración oficial.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay movimientos este año.</p>
          ) : (
            <ul className="divide-y">
              {data.recent.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.kind === "invoice" ? `/facturas/${item.id}` : "/gastos"}
                    className="flex items-center gap-3 py-3 hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full",
                        item.kind === "invoice" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                      )}
                    >
                      {item.kind === "invoice" ? <FileText className="size-4" /> : <Receipt className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(item.date)} · {item.subtitle}
                      </span>
                    </span>
                    <span className={cn("font-mono text-sm tabular-nums", item.kind === "invoice" ? "text-emerald-700" : "text-rose-700")}>
                      {item.kind === "invoice" ? "+" : "−"}
                      {formatEUR(item.amountCents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  href,
  footnote,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  href?: string;
  footnote?: string;
}) {
  const content = (
    <Card className="h-full transition-colors hover:bg-muted/30">
      <CardContent className="flex flex-col gap-2">
        <span className="flex items-center justify-between text-sm text-muted-foreground">
          {label}
          <Icon className={cn("size-4", tone)} />
        </span>
        <span className="font-mono text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</span>
        {footnote && <span className="text-xs text-muted-foreground">{footnote}</span>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function TaxLine({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span>
        {label}
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

