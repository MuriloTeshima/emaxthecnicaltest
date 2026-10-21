"use client";

import { Info, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AmountRow } from "@/components/amount-row";
import { ContactDialog } from "@/components/contacts/contact-dialog";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { invoiceTotals, lineBaseCents } from "@/domain/invoice";
import { formatEUR, parseEuros } from "@/domain/money";
import { addDays, parseISODate, toISODate } from "@/domain/period";
import { DEFAULT_VAT_RATE, type OperationType, VAT_RATES, isIntraEu } from "@/domain/rates";
import { countryName, isIntraCommunityCountry } from "@/domain/tax-id";
import type { Contact } from "@/generated/prisma/browser";
import type { FieldErrors } from "@/lib/action-result";
import { createInvoice } from "@/server/actions/invoices";
import { createQuote } from "@/server/actions/quotes";

interface LineState {
  key: number;
  description: string;
  quantity: string;
  price: string;
  vatRate: number;
}

const OPERATION_LABELS: Record<OperationType, string> = {
  DOMESTIC: "Nacional (con IVA)",
  EU_SERVICES: "Intracomunitaria · servicios",
  EU_GOODS: "Intracomunitaria · bienes",
};

let nextKey = 1;
const emptyLine = (): LineState => ({ key: nextKey++, description: "", quantity: "1", price: "", vatRate: DEFAULT_VAT_RATE });

function parseQuantity(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const COPY = {
  invoice: {
    endLabel: "Vencimiento",
    endHint: (days: number) => `Por defecto, ${days} días.`,
    endField: "dueDate",
    submit: "Guardar factura",
    saved: (number: string) => `Factura ${number} guardada.`,
    path: "/facturas",
  },
  quote: {
    endLabel: "Válido hasta",
    endHint: (days: number) => `Validez por defecto: ${days} días.`,
    endField: "validUntil",
    submit: "Guardar presupuesto",
    saved: (number: string) => `Presupuesto ${number} guardado.`,
    path: "/presupuestos",
  },
} as const;

/** Form shared by invoices and quotes: same client, lines and VAT logic. */
export function SalesDocumentForm({
  kind,
  contacts: initialContacts,
  today,
  termDays,
}: {
  kind: "invoice" | "quote";
  contacts: Contact[];
  today: string;
  /** Default days until the due date (invoices) or the end of validity (quotes). */
  termDays: number;
}) {
  const copy = COPY[kind];
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [endDate, setEndDate] = useState(toISODate(addDays(parseISODate(today)!, termDays)));
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("DOMESTIC");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const contact = contacts.find((c) => c.id === contactId);
  const intraEu = isIntraEu(operationType);

  const parsedLines = lines.map((l) => ({
    description: l.description,
    quantity: parseQuantity(l.quantity),
    unitPriceCents: parseEuros(l.price),
    vatRate: l.vatRate,
  }));

  const totals = useMemo(
    () =>
      invoiceTotals(
        parsedLines
          .filter((l) => l.quantity !== null && l.unitPriceCents !== null)
          .map((l) => ({ ...l, quantity: l.quantity!, unitPriceCents: l.unitPriceCents! })),
        operationType,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, operationType],
  );

  function selectContact(id: string, list = contacts) {
    setContactId(id);
    const selected = list.find((c) => c.id === id);
    if (!selected) return;
    // Suggest the operation type from the client's country; the user can still change it.
    if (isIntraCommunityCountry(selected.country)) {
      if (!isIntraEu(operationType)) setOperationType("EU_SERVICES");
    } else {
      setOperationType("DOMESTIC");
    }
  }

  function changeIssueDate(value: string) {
    setIssueDate(value);
    const parsed = parseISODate(value);
    if (parsed && !endDateTouched) setEndDate(toISODate(addDays(parsed, termDays)));
  }

  function updateLine(key: number, patch: Partial<LineState>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const clientErrors: FieldErrors = {};
    parsedLines.forEach((l, i) => {
      if (l.quantity === null) clientErrors[`lines.${i}.quantity`] = "Cantidad no válida.";
      if (l.unitPriceCents === null) clientErrors[`lines.${i}.unitPriceCents`] = "Precio no válido.";
    });
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      toast.error("Revisa los campos marcados.");
      return;
    }

    startTransition(async () => {
      const common = {
        contactId,
        issueDate,
        operationType,
        notes,
        lines: parsedLines.map((l) => ({
          description: l.description,
          quantity: l.quantity!,
          unitPriceCents: l.unitPriceCents!,
          vatRate: intraEu ? 0 : l.vatRate,
        })),
      };
      const result =
        kind === "invoice" ? await createInvoice({ ...common, dueDate: endDate }) : await createQuote({ ...common, validUntil: endDate });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(copy.saved(result.data.number));
      router.push(`${copy.path}/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_20rem]" noValidate>
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente y fechas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" htmlFor="contactId" error={errors.contactId} className="sm:col-span-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <NativeSelect
                    id="contactId"
                    value={contactId}
                    onChange={(e) => selectContact(e.target.value)}
                    aria-invalid={!!errors.contactId}
                  >
                    <option value="">Selecciona un cliente…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.nif}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
                  <UserPlus />
                  <span className="hidden sm:inline">Nuevo</span>
                </Button>
              </div>
            </Field>

            <Field label="Fecha de emisión" htmlFor="issueDate" error={errors.issueDate}>
              <Input id="issueDate" type="date" value={issueDate} onChange={(e) => changeIssueDate(e.target.value)} />
            </Field>
            <Field label={copy.endLabel} htmlFor="endDate" error={errors[copy.endField]} hint={copy.endHint(termDays)}>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setEndDateTouched(true);
                }}
              />
            </Field>

            <Field label="Tipo de operación" htmlFor="operationType" className="sm:col-span-2">
              <NativeSelect
                id="operationType"
                value={operationType}
                onChange={(e) => setOperationType(e.target.value as OperationType)}
              >
                {(Object.keys(OPERATION_LABELS) as OperationType[]).map((op) => (
                  <option key={op} value={op}>
                    {OPERATION_LABELS[op]}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {intraEu && (
              <p className="flex gap-2 rounded-lg bg-primary/5 p-3 text-sm text-primary sm:col-span-2">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Factura sin IVA por inversión del sujeto pasivo
                  {contact ? ` (cliente en ${countryName(contact.country)})` : ""}. Se declarará en el modelo 349.
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conceptos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {errors.lines && <p className="text-sm text-destructive">{errors.lines}</p>}
            {lines.map((line, index) => {
              const parsed = parsedLines[index];
              const base =
                parsed.quantity !== null && parsed.unitPriceCents !== null
                  ? lineBaseCents({ quantity: parsed.quantity, unitPriceCents: parsed.unitPriceCents })
                  : null;
              return (
                <div key={line.key} className="grid grid-cols-6 items-start gap-2 rounded-lg border p-3 sm:grid-cols-12 sm:border-0 sm:p-0">
                  <Field label="Concepto" htmlFor={`desc-${line.key}`} error={errors[`lines.${index}.description`]} className="col-span-6 sm:col-span-4">
                    <Input
                      id={`desc-${line.key}`}
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      placeholder="Ej. Instalación placas solares"
                      aria-invalid={!!errors[`lines.${index}.description`]}
                    />
                  </Field>
                  <Field label="Cant." htmlFor={`qty-${line.key}`} error={errors[`lines.${index}.quantity`]} className="col-span-2 sm:col-span-1">
                    <Input
                      id={`qty-${line.key}`}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      aria-invalid={!!errors[`lines.${index}.quantity`]}
                    />
                  </Field>
                  <Field label="Precio €" htmlFor={`price-${line.key}`} error={errors[`lines.${index}.unitPriceCents`]} className="col-span-4 sm:col-span-2">
                    <Input
                      id={`price-${line.key}`}
                      inputMode="decimal"
                      value={line.price}
                      onChange={(e) => updateLine(line.key, { price: e.target.value })}
                      placeholder="0,00"
                      aria-invalid={!!errors[`lines.${index}.unitPriceCents`]}
                    />
                  </Field>
                  <Field label="IVA" htmlFor={`vat-${line.key}`} className="col-span-2 sm:col-span-2">
                    <NativeSelect
                      id={`vat-${line.key}`}
                      value={intraEu ? 0 : line.vatRate}
                      disabled={intraEu}
                      onChange={(e) => updateLine(line.key, { vatRate: Number(e.target.value) })}
                    >
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <div className="col-span-3 flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-sm font-medium">Importe</span>
                    <span className="flex h-8 items-center justify-end font-mono text-sm tabular-nums">
                      {base !== null ? formatEUR(base) : "—"}
                    </span>
                  </div>
                  <div className="col-span-1 flex h-full items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar concepto"
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" className="self-start" onClick={() => setLines((c) => [...c, emptyLine()])}>
              <Plus />
              Añadir concepto
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Field label="Notas (opcional)" htmlFor="notes">
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Forma de pago, IBAN, observaciones…" />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <AmountRow label="Base imponible" value={formatEUR(totals.baseCents)} />
            {totals.breakdown
              .filter((b) => b.vatRate > 0)
              .map((b) => (
                <AmountRow key={b.vatRate} label={`IVA ${b.vatRate}%`} value={formatEUR(b.vatCents)} />
              ))}
            {intraEu && <AmountRow label="IVA" value="Exento (ISP)" />}
            <Separator className="my-2" />
            <AmountRow label="Total" value={formatEUR(totals.totalCents)} strong />
            <Button type="submit" size="lg" className="mt-4" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {copy.submit}
            </Button>
            <p className="text-center text-xs text-muted-foreground">El número se asigna automáticamente al guardar.</p>
          </CardContent>
        </Card>
      </div>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kind="CLIENT"
        onCreated={(created) => {
          const updated = [...contacts, created].sort((a, b) => a.name.localeCompare(b.name, "es"));
          setContacts(updated);
          selectContact(created.id, updated);
        }}
      />
    </form>
  );
}
