"use client";

import { Building2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/lib/action-result";
import { createCompany } from "@/server/actions/companies";

export function NewCompanyForm() {
  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createCompany({ name, nif });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      // The new company is now the active one: reload everything.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/configuracion");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Otra empresa</CardTitle>
        <CardDescription>
          Cada empresa tiene sus propios contactos, facturas, gastos, bancos e impuestos. Cambia de una a otra desde el selector
          del menú.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid items-start gap-4 sm:grid-cols-[1fr_12rem_auto]" noValidate>
          <Field label="Razón social" htmlFor="new-company-name" error={errors.name}>
            <Input id="new-company-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
          </Field>
          <Field label="NIF / CIF" htmlFor="new-company-nif" error={errors.nif}>
            <Input id="new-company-nif" value={nif} onChange={(e) => setNif(e.target.value)} aria-invalid={!!errors.nif} />
          </Field>
          <Button type="submit" variant="outline" className="sm:mt-6" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Building2 />}
            Crear empresa
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
