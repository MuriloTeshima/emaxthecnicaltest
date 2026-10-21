"use client";

import { AlertTriangle, Info, Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AmountRow } from "@/components/amount-row";
import { ContactDialog } from "@/components/contacts/contact-dialog";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { expenseAmounts } from "@/domain/expense";
import { formatEUR, parseEuros } from "@/domain/money";
import {
  DEFAULT_PROFESSIONAL_IRPF,
  DEFAULT_VAT_RATE,
  IRPF_RATES,
  type OperationType,
  REVERSE_CHARGE_VAT_RATE,
  VAT_RATES,
  isIntraEu,
} from "@/domain/rates";
import { isIntraCommunityCountry, normalizeTaxId } from "@/domain/tax-id";
import type { Contact } from "@/generated/prisma/browser";
import type { FieldErrors } from "@/lib/action-result";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/schemas/expense";
import { createExpense } from "@/server/actions/expenses";

const OPERATION_LABELS: Record<OperationType, string> = {
  DOMESTIC: "Nacional",
  EU_SERVICES: "Adquisición intracomunitaria · servicios",
  EU_GOODS: "Adquisición intracomunitaria · bienes",
};

export interface ExpenseFormInitial {
  supplierId?: string;
  number?: string;
  date?: string;
  concept?: string;
  category?: ExpenseCategory;
  base?: string;
  vatRate?: number;
  irpfRate?: number;
  operationType?: OperationType;
}

export interface DetectedSupplier {
  name: string;
  nif: string;
  country: string;
}

export function ExpenseForm({
  suppliers: initialSuppliers,
  today,
  initial,
  detectedSupplier,
  warnings = {},
  documentId,
  submitLabel = "Guardar gasto",
}: {
  suppliers: Contact[];
  today: string;
  initial?: ExpenseFormInitial;
  /** Supplier read from a document that does not exist yet as a contact. */
  detectedSupplier?: DetectedSupplier;
  /** Consistency warnings from OCR, keyed by field. */
  warnings?: Partial<Record<"base" | "vatRate" | "irpfRate" | "total" | "date" | "supplier", string>>;
  documentId?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [number, setNumber] = useState(initial?.number ?? "");
  const [date, setDate] = useState(initial?.date ?? today);
  const [concept, setConcept] = useState(initial?.concept ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? "general");
  const [base, setBase] = useState(initial?.base ?? "");
  const [vatRate, setVatRate] = useState(initial?.vatRate ?? DEFAULT_VAT_RATE);
  const [irpfRate, setIrpfRate] = useState(initial?.irpfRate ?? 0);
  const [operationType, setOperationType] = useState<OperationType>(initial?.operationType ?? "DOMESTIC");
  const [deductible, setDeductible] = useState(true);
  const [paid, setPaid] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const intraEu = isIntraEu(operationType);
  const baseCents = parseEuros(base);
  const effectiveVat = intraEu ? REVERSE_CHARGE_VAT_RATE : vatRate;
  const amounts = expenseAmounts({ baseCents: baseCents ?? 0, vatRate: effectiveVat, irpfRate, operationType });
  const showDetected = detectedSupplier && !supplierId;

  function selectSupplier(id: string, list = suppliers) {
    setSupplierId(id);
    const supplier = list.find((s) => s.id === id);
    if (!supplier) return;
    if (isIntraCommunityCountry(supplier.country)) {
      setOperationType((op) => (isIntraEu(op) ? op : "EU_SERVICES"));
      setIrpfRate(0);
    } else {
      setOperationType("DOMESTIC");
      setIrpfRate(supplier.isProfessional ? DEFAULT_PROFESSIONAL_IRPF : 0);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (baseCents === null || baseCents <= 0) {
      setErrors({ baseCents: "Indica una base imponible válida." });
      toast.error("Revisa los campos marcados.");
      return;
    }
    startTransition(async () => {
      const result = await createExpense({
        supplierId,
        number,
        date,
        concept,
        category,
        baseCents,
        vatRate: effectiveVat,
        irpfRate,
        operationType,
        deductible,
        paid,
        documentId,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Gasto registrado.");
      router.push("/gastos");
    });
  }

  return (
    // Container query: next to the document preview the form is narrower than the viewport suggests.
    <div className="@container">
      <form onSubmit={submit} className="grid gap-6 @3xl:grid-cols-[1fr_20rem]" noValidate>
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Proveedor y documento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {showDetected && (
                <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-amber-800">
                    Proveedor detectado: <strong>{detectedSupplier.name || "sin nombre"}</strong>
                    {detectedSupplier.nif && ` · ${normalizeTaxId(detectedSupplier.nif)}`}. No está en tus contactos.
                  </p>
                  <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
                    <UserPlus />
                    Crear proveedor
                  </Button>
                </div>
              )}

              <Field label="Proveedor" htmlFor="supplierId" error={errors.supplierId} className="sm:col-span-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <NativeSelect id="supplierId" value={supplierId} onChange={(e) => selectSupplier(e.target.value)} aria-invalid={!!errors.supplierId}>
                      <option value="">Selecciona un proveedor…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.nif}
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

              <Field label="Nº de factura (opcional)" htmlFor="number">
                <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ej. A-2026-118" />
              </Field>
              <Field label="Fecha" htmlFor="date" error={errors.date} hint={warn(warnings.date)}>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
              </Field>
              <Field label="Concepto" htmlFor="concept" error={errors.concept} className="sm:col-span-2">
                <Input id="concept" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Asesoría fiscal trimestral" aria-invalid={!!errors.concept} />
              </Field>
              <Field label="Categoría" htmlFor="category">
                <NativeSelect id="category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                  {Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Tipo de operación" htmlFor="operationType">
                <NativeSelect id="operationType" value={operationType} onChange={(e) => setOperationType(e.target.value as OperationType)}>
                  {(Object.keys(OPERATION_LABELS) as OperationType[]).map((op) => (
                    <option key={op} value={op}>
                      {OPERATION_LABELS[op]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Importes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Base imponible €" htmlFor="base" error={errors.baseCents} hint={warn(warnings.base)}>
                <Input id="base" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} placeholder="0,00" aria-invalid={!!errors.baseCents} />
              </Field>
              <Field label="IVA" htmlFor="vatRate" hint={warn(warnings.vatRate)}>
                <NativeSelect id="vatRate" value={effectiveVat} disabled={intraEu} onChange={(e) => setVatRate(Number(e.target.value))}>
                  {VAT_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Retención IRPF" htmlFor="irpfRate" hint={warn(warnings.irpfRate) ?? "Solo facturas de profesionales."}>
                <NativeSelect id="irpfRate" value={irpfRate} onChange={(e) => setIrpfRate(Number(e.target.value))}>
                  {IRPF_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r === 0 ? "Sin retención" : `${r}%`}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              {intraEu && (
                <p className="flex gap-2 rounded-lg bg-primary/5 p-3 text-sm text-primary sm:col-span-3">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  El proveedor no cobra IVA: se autorrepercute al {REVERSE_CHARGE_VAT_RATE}% (devengado y deducible en el 303) y la operación se declara en el 349.
                </p>
              )}

              <div className="flex flex-col gap-3 sm:col-span-3">
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox checked={deductible} onCheckedChange={(v) => setDeductible(v === true)} />
                  IVA deducible (gasto afecto a la actividad)
                </Label>
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox checked={paid} onCheckedChange={(v) => setPaid(v === true)} />
                  Ya está pagado
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="@3xl:sticky @3xl:top-8 @3xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <AmountRow label="Base imponible" value={formatEUR(amounts.baseCents)} />
              <AmountRow
                label={intraEu ? `IVA autorrepercutido ${effectiveVat}%` : `IVA soportado ${effectiveVat}%`}
                value={formatEUR(amounts.vatCents)}
              />
              {irpfRate > 0 && <AmountRow label={`Retención IRPF ${irpfRate}%`} value={`− ${formatEUR(amounts.irpfCents)}`} />}
              <Separator className="my-2" />
              <AmountRow label="Total a pagar" value={formatEUR(amounts.totalCents)} strong />
              {warnings.total && (
                <p className="flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  {warnings.total}
                </p>
              )}
              <Button type="submit" size="lg" className="mt-4" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {submitLabel}
              </Button>
            </CardContent>
          </Card>
        </div>

        <ContactDialog
          key={detectedSupplier ? `${detectedSupplier.nif}-${detectedSupplier.name}` : "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          kind="SUPPLIER"
          initial={showDetected ? { ...detectedSupplier, isProfessional: irpfRate > 0 } : undefined}
          onCreated={(created) => {
            const updated = [...suppliers, created].sort((a, b) => a.name.localeCompare(b.name, "es"));
            setSuppliers(updated);
            selectSupplier(created.id, updated);
            if (initial?.irpfRate) setIrpfRate(initial.irpfRate);
          }}
        />
      </form>
    </div>
  );
}

function warn(message?: string) {
  return message ? <span className="text-amber-600">{message}</span> : undefined;
}
