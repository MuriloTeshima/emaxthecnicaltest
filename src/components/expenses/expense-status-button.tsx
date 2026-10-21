"use client";

import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setExpenseStatus } from "@/server/actions/expenses";

export function ExpenseStatusButton({ id, status }: { id: string; status: "PENDING" | "PAID" }) {
  const [pending, startTransition] = useTransition();
  const next = status === "PAID" ? "PENDING" : "PAID";

  return (
    <Button
      type="button"
      size="sm"
      variant={status === "PAID" ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setExpenseStatus(id, next);
          if (!result.ok) toast.error(result.error);
          else toast.success(next === "PAID" ? "Gasto marcado como pagado." : "Gasto marcado como pendiente.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : status === "PAID" ? <RotateCcw /> : <CheckCircle2 />}
      {status === "PAID" ? "Marcar pendiente" : "Marcar pagado"}
    </Button>
  );
}
