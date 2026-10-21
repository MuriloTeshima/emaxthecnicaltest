"use client";

import { Loader2, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EU_COUNTRIES, validateTaxId } from "@/domain/tax-id";
import type { Contact } from "@/generated/prisma/browser";
import type { FieldErrors } from "@/lib/action-result";
import { updateContact } from "@/server/actions/contacts";

const COUNTRY_OPTIONS = Object.entries(EU_COUNTRIES).sort(([, a], [, b]) => a.localeCompare(b, "es"));

export function ContactEditDialog({ contact }: { contact: Contact }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    kind: contact.kind,
    name: contact.name,
    nif: contact.nif,
    country: contact.country,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    notes: contact.notes ?? "",
    isProfessional: contact.isProfessional,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const nifWarning = values.nif.trim() ? validateTaxId(values.country, values.nif) : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    startTransition(async () => {
      const result = await updateContact(contact.id, values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setOpen(false);
      toast.success("Contacto actualizado.");
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil />
        Editar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Editar contacto</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre o razón social" htmlFor="edit-name" error={errors.name} className="sm:col-span-2">
                <Input id="edit-name" value={values.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} />
              </Field>
              <Field label="Tipo" htmlFor="edit-kind" error={errors.kind}>
                <NativeSelect id="edit-kind" value={values.kind} onChange={(e) => set({ kind: e.target.value as Contact["kind"] })}>
                  <option value="CLIENT">Cliente</option>
                  <option value="SUPPLIER">Proveedor</option>
                  <option value="BOTH">Cliente y proveedor</option>
                </NativeSelect>
              </Field>
              <Field label="País" htmlFor="edit-country">
                <NativeSelect id="edit-country" value={values.country} onChange={(e) => set({ country: e.target.value })}>
                  {COUNTRY_OPTIONS.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label={values.country === "ES" ? "NIF / CIF" : "NIF-IVA"}
                htmlFor="edit-nif"
                error={errors.nif}
                hint={nifWarning ? <span className="text-amber-600">{nifWarning}</span> : undefined}
              >
                <Input id="edit-nif" value={values.nif} onChange={(e) => set({ nif: e.target.value })} aria-invalid={!!errors.nif} />
              </Field>
              <Field label="Teléfono" htmlFor="edit-phone" error={errors.phone}>
                <Input id="edit-phone" value={values.phone} onChange={(e) => set({ phone: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor="edit-email" error={errors.email} className="sm:col-span-2">
                <Input id="edit-email" type="email" value={values.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={!!errors.email} />
              </Field>
              <Field label="Dirección" htmlFor="edit-address" error={errors.address} className="sm:col-span-2">
                <Input id="edit-address" value={values.address} onChange={(e) => set({ address: e.target.value })} />
              </Field>
              <Field label="Notas internas" htmlFor="edit-notes" error={errors.notes} className="sm:col-span-2">
                <Textarea id="edit-notes" rows={2} value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            </div>

            {values.kind !== "CLIENT" && (
              <Label className="flex items-start gap-2 font-normal">
                <Checkbox checked={values.isProfessional} onCheckedChange={(v) => set({ isProfessional: v === true })} className="mt-0.5" />
                <span>
                  Es un profesional autónomo
                  <span className="block text-xs text-muted-foreground">Sus facturas llevan retención de IRPF (modelo 111).</span>
                </span>
              </Label>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
