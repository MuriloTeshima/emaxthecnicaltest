"use client";

import { Check, FileText, Loader2, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { convertQuoteToInvoice, setQuoteStatus } from "@/server/actions/quotes";

type Status = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "INVOICED";

export function QuoteActions({ id, status }: { id: string; status: Status }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: "SENT" | "ACCEPTED" | "REJECTED", message: string) {
    startTransition(async () => {
      const result = await setQuoteStatus(id, next);
      if (!result.ok) toast.error(result.error);
      else toast.success(message);
    });
  }

  function convert() {
    startTransition(async () => {
      const result = await convertQuoteToInvoice(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Factura ${result.data.number} creada a partir del presupuesto.`);
      router.push(`/facturas/${result.data.id}`);
    });
  }

  if (status === "INVOICED") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {pending && <Loader2 className="size-5 animate-spin self-center text-muted-foreground" />}
      {status === "DRAFT" && (
        <Button variant="outline" disabled={pending} onClick={() => change("SENT", "Presupuesto marcado como enviado.")}>
          <Send />
          Marcar enviado
        </Button>
      )}
      {(status === "DRAFT" || status === "SENT") && (
        <>
          <Button variant="outline" disabled={pending} onClick={() => change("REJECTED", "Presupuesto marcado como rechazado.")}>
            <X />
            Rechazado
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => change("ACCEPTED", "Presupuesto aceptado.")}>
            <Check />
            Aceptado
          </Button>
        </>
      )}
      {status === "REJECTED" && (
        <Button variant="outline" disabled={pending} onClick={() => change("SENT", "Presupuesto reabierto.")}>
          <Send />
          Reabrir
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button disabled={pending} onClick={convert}>
          <FileText />
          Convertir en factura
        </Button>
      )}
    </div>
  );
}
