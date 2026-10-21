import { Info } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { AmountRow } from "@/components/amount-row";
import { PageHeader } from "@/components/page-header";
import { PeriodSelect } from "@/components/period-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPeriod, parsePeriodParam, quarterOf, todayUTC } from "@/domain/period";
import { MODEL_349_KEY_LABELS } from "@/domain/taxes";
import { countryName } from "@/domain/tax-id";
import { formatEUR } from "@/lib/format";
import { getTaxReport } from "@/server/queries/ledger";

export const metadata = { title: "Impuestos" };

export default function TaxesPage({ searchParams }: PageProps<"/impuestos">) {
  return (
    <>
      <PageHeader title="Impuestos" description="Estimaciones calculadas en tiempo real a partir de tus facturas y gastos." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TaxReport searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TaxReport({ searchParams }: { searchParams: PageProps<"/impuestos">["searchParams"] }) {
  const params = await searchParams;
  await connection(); // "today" must be computed per request
  const current = quarterOf(todayUTC());
  const period = parsePeriodParam(typeof params.periodo === "string" ? params.periodo : undefined, current);
  const { m303, m111, m349, counts } = await getTaxReport(period);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {formatPeriod(period)}: {counts.invoices} facturas emitidas y {counts.expenses} gastos. Estimación orientativa, no es
            una declaración oficial.
          </span>
        </p>
        <PeriodSelect value={period} current={current} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Modelo 303 · IVA</CardTitle>
            <CardDescription>IVA repercutido menos IVA soportado deducible.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="font-medium">IVA devengado</p>
            {m303.accrued.length === 0 && <AmountRow label="Sin ventas con IVA" value={formatEUR(0)} />}
            {m303.accrued.map((row) => (
              <AmountRow key={row.vatRate} label={`Base ${formatEUR(row.baseCents)} al ${row.vatRate}%`} value={formatEUR(row.vatCents)} />
            ))}
            {m303.reverseChargeVatCents > 0 && (
              <AmountRow label={`Adquisiciones intracomunitarias (base ${formatEUR(m303.reverseChargeBaseCents)})`} value={formatEUR(m303.reverseChargeVatCents)} />
            )}
            <p className="mt-3 font-medium">IVA deducible</p>
            <AmountRow label={`Compras y gastos (base ${formatEUR(m303.deductibleBaseCents)})`} value={`− ${formatEUR(m303.deductibleVatCents)}`} />
            {m303.intraEuSuppliesBaseCents > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Entregas intracomunitarias exentas (informativo): {formatEUR(m303.intraEuSuppliesBaseCents)}
              </p>
            )}
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">Resultado</span>
              <span className="flex items-center gap-2">
                <ResultBadge cents={m303.resultCents} />
                <span className="font-mono text-base font-semibold tabular-nums">{formatEUR(m303.resultCents)}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modelo 111 · Retenciones IRPF</CardTitle>
            <CardDescription>Retenciones practicadas en facturas de profesionales.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {m111.items.length === 0 ? (
              <p className="text-muted-foreground">No hay facturas con retención en este trimestre.</p>
            ) : (
              m111.items.map((item) => (
                <AmountRow
                  key={item.expenseId}
                  label={`${item.supplierName} · base ${formatEUR(item.baseCents)} al ${item.irpfRate}%`}
                  value={formatEUR(item.irpfCents)}
                />
              ))
            )}
            <Separator className="my-2" />
            <AmountRow label="Perceptores" value={String(m111.recipients)} />
            <AmountRow label="Base de las retenciones" value={formatEUR(m111.baseCents)} />
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">A ingresar</span>
              <span className="font-mono text-base font-semibold tabular-nums">{formatEUR(m111.withheldCents)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo 349 · Operaciones intracomunitarias</CardTitle>
          <CardDescription>Resumen por operador y clave de operación.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {m349.rows.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">No hay operaciones intracomunitarias en este trimestre.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Operador</TableHead>
                    <TableHead>NIF-IVA</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Clave</TableHead>
                    <TableHead className="pr-6 text-right">Base imponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m349.rows.map((row) => (
                    <TableRow key={`${row.vatNumber}-${row.key}`}>
                      <TableCell className="pl-6 font-medium">{row.name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.vatNumber}</TableCell>
                      <TableCell>{countryName(row.country)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {row.key}
                        </Badge>{" "}
                        <span className="text-xs text-muted-foreground">{MODEL_349_KEY_LABELS[row.key]}</span>
                      </TableCell>
                      <TableCell className="pr-6 text-right font-mono tabular-nums">{formatEUR(row.baseCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between px-6 pt-4 text-sm">
                <span className="text-muted-foreground">{m349.operators} operador(es)</span>
                <span className="font-mono font-semibold tabular-nums">Total {formatEUR(m349.totalBaseCents)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultBadge({ cents }: { cents: number }) {
  if (cents > 0) return <Badge className="bg-amber-50 text-amber-700 border-amber-200" variant="outline">A ingresar</Badge>;
  if (cents < 0) return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">A compensar</Badge>;
  return <Badge variant="outline">Sin cuota</Badge>;
}
