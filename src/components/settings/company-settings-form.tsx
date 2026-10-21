"use client";

import { Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { validateTaxId } from "@/domain/tax-id";
import type { FieldErrors } from "@/lib/action-result";
import { updateCompanySettings } from "@/server/actions/companies";

export interface CompanySettingsValues {
  name: string;
  nif: string;
  address: string;
  email: string;
  phone: string;
  iban: string;
  invoiceSeries: string;
  quoteSeries: string;
  paymentTermDays: number;
}

export function CompanySettingsForm({ initial }: { initial: CompanySettingsValues }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<CompanySettingsValues>) => setValues((v) => ({ ...v, ...patch }));
  const nifWarning = values.nif.trim() ? validateTaxId("ES", values.nif) : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateCompanySettings(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      toast.success("Configuración guardada.");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales</CardTitle>
          <CardDescription>Aparecen en las facturas y presupuestos que emites.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Razón social" htmlFor="name" error={errors.name}>
            <Input id="name" value={values.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} />
          </Field>
          <Field label="NIF / CIF" htmlFor="nif" error={errors.nif} hint={nifWarning ? <span className="text-amber-600">{nifWarning}</span> : undefined}>
            <Input id="nif" value={values.nif} onChange={(e) => set({ nif: e.target.value })} aria-invalid={!!errors.nif} />
          </Field>
          <Field label="Dirección" htmlFor="address" error={errors.address} className="sm:col-span-2">
            <Input id="address" value={values.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" type="email" value={values.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!errors.email} />
          </Field>
          <Field label="Teléfono" htmlFor="phone" error={errors.phone}>
            <Input id="phone" value={values.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="IBAN para cobros" htmlFor="iban" error={errors.iban} hint="Se imprime en el PDF de las facturas." className="sm:col-span-2">
            <Input id="iban" value={values.iban} onChange={(e) => set({ iban: e.target.value })} placeholder="ES00 0000 0000 0000 0000 0000" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facturación</CardTitle>
          <CardDescription>Numeración y condiciones por defecto.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Serie de facturas" htmlFor="invoiceSeries" error={errors.invoiceSeries} hint={`Ej.: ${values.invoiceSeries || "F"}2026-0001`}>
            <Input id="invoiceSeries" value={values.invoiceSeries} onChange={(e) => set({ invoiceSeries: e.target.value.toUpperCase() })} maxLength={4} aria-invalid={!!errors.invoiceSeries} />
          </Field>
          <Field label="Serie de presupuestos" htmlFor="quoteSeries" error={errors.quoteSeries} hint={`Ej.: ${values.quoteSeries || "P"}2026-0001`}>
            <Input id="quoteSeries" value={values.quoteSeries} onChange={(e) => set({ quoteSeries: e.target.value.toUpperCase() })} maxLength={4} aria-invalid={!!errors.quoteSeries} />
          </Field>
          <Field label="Plazo de pago (días)" htmlFor="paymentTermDays" error={errors.paymentTermDays} hint="Vencimiento por defecto.">
            <Input
              id="paymentTermDays"
              type="number"
              min={0}
              max={365}
              value={values.paymentTermDays}
              onChange={(e) => set({ paymentTermDays: Number(e.target.value) })}
              aria-invalid={!!errors.paymentTermDays}
            />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Cambiar la serie solo afecta a los documentos nuevos; la numeración sigue siendo correlativa por serie y año.
          </p>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
