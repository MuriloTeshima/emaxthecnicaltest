import { AmountRow } from "@/components/amount-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type InvoiceLineInput, type InvoiceTotals, lineBaseCents } from "@/domain/invoice";
import { countryName, toEuVatNumber } from "@/domain/tax-id";
import { formatEUR } from "@/lib/format";

/** Building blocks shared by the invoice and quote detail pages. */

export function LinesCard({ lines, intraEu, notes }: { lines: InvoiceLineInput[]; intraEu: boolean; notes: string | null }) {
  return (
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
            {lines.map((line, i) => (
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
        {notes && <p className="px-6 pt-4 text-sm whitespace-pre-line text-muted-foreground">{notes}</p>}
      </CardContent>
    </Card>
  );
}

export function ClientCard({
  contact,
  intraEu,
}: {
  contact: { name: string; nif: string; country: string; email: string | null };
  intraEu: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cliente</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <p className="font-medium">{contact.name}</p>
        <p className="text-muted-foreground">{intraEu ? `NIF-IVA ${toEuVatNumber(contact.country, contact.nif)}` : `NIF ${contact.nif}`}</p>
        <p className="text-muted-foreground">{countryName(contact.country)}</p>
        {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
      </CardContent>
    </Card>
  );
}

export function TotalsCard({ totals, intraEu }: { totals: InvoiceTotals; intraEu: boolean }) {
  return (
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
  );
}
