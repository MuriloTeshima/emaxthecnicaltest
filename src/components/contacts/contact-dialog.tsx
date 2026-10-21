"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EU_COUNTRIES, validateTaxId } from "@/domain/tax-id";
import type { Contact } from "@/generated/prisma/browser";
import type { FieldErrors } from "@/lib/action-result";
import { createContact } from "@/server/actions/contacts";

const COUNTRY_OPTIONS = Object.entries(EU_COUNTRIES).sort(([, a], [, b]) => a.localeCompare(b, "es"));

export function ContactDialog({
  open,
  onOpenChange,
  kind,
  initial,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "CLIENT" | "SUPPLIER";
  /** Prefill, e.g. with the supplier detected by OCR. Remount (key) to apply new values. */
  initial?: { name?: string; nif?: string; country?: string; isProfessional?: boolean };
  onCreated: (contact: Contact) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nif, setNif] = useState(initial?.nif ?? "");
  const [country, setCountry] = useState(initial?.country && initial.country in EU_COUNTRIES ? initial.country : "ES");
  const [email, setEmail] = useState("");
  const [isProfessional, setIsProfessional] = useState(initial?.isProfessional ?? false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const nifWarning = nif.trim() ? validateTaxId(country, nif) : null;
  const noun = kind === "CLIENT" ? "cliente" : "proveedor";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    // The dialog is rendered inside the invoice/expense form; React bubbles
    // submit events through portals, which would also submit the host form.
    event.stopPropagation();
    startTransition(async () => {
      const result = await createContact({ kind, name, nif, country, email, isProfessional });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.name} añadido.`);
      onCreated(result.data);
      onOpenChange(false);
      setName("");
      setNif("");
      setEmail("");
      setErrors({});
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Nuevo {noun}</DialogTitle>
            <DialogDescription>Solo lo imprescindible. Podrás reutilizarlo en próximas operaciones.</DialogDescription>
          </DialogHeader>

          <Field label="Nombre o razón social" htmlFor="contact-name" error={errors.name}>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-invalid={!!errors.name} />
          </Field>

          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <Field
              label={country === "ES" ? "NIF / CIF" : "NIF-IVA"}
              htmlFor="contact-nif"
              error={errors.nif}
              hint={nifWarning ? <span className="text-amber-600">{nifWarning}</span> : undefined}
            >
              <Input
                id="contact-nif"
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder={country === "ES" ? "B12345674" : "DE123456789"}
                aria-invalid={!!errors.nif}
              />
            </Field>
            <Field label="País" htmlFor="contact-country" error={errors.country}>
              <NativeSelect id="contact-country" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRY_OPTIONS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field label="Email (opcional)" htmlFor="contact-email" error={errors.email}>
            <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>

          {kind === "SUPPLIER" && (
            <Label className="flex items-start gap-2 font-normal">
              <Checkbox checked={isProfessional} onCheckedChange={(v) => setIsProfessional(v === true)} className="mt-0.5" />
              <span>
                Es un profesional autónomo
                <span className="block text-xs text-muted-foreground">Sus facturas llevan retención de IRPF (modelo 111).</span>
              </span>
            </Label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Guardar {noun}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
