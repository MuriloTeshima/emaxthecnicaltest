"use client";

import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setInvoiceStatus } from "@/server/actions/invoices";

export function InvoiceStatusButton({
  id,
  status,
  size = "default",
}: {
  id: string;
  status: "PENDING" | "PAID";
  size?: "default" | "sm";
}) {
  const [pending, startTransition] = useTransition();
  const next = status === "PAID" ? "PENDING" : "PAID";

  function toggle() {
    startTransition(async () => {
      const result = await setInvoiceStatus(id, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(next === "PAID" ? "Factura marcada como cobrada." : "Factura marcada como pendiente.");
    });
  }

  return (
    <Button type="button" variant={status === "PAID" ? "outline" : "default"} size={size} onClick={toggle} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : status === "PAID" ? <RotateCcw /> : <CheckCircle2 />}
      {status === "PAID" ? "Marcar pendiente" : "Marcar cobrada"}
    </Button>
  );
}
