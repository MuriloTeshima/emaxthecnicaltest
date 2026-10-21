"use client";

import { Link2, Loader2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { reconcileMovement, undoReconciliation } from "@/server/actions/bank";

export interface SuggestionOption {
  kind: "invoice" | "expense";
  id: string;
  label: string;
  counterparty: string;
}

export function ReconcileControl({ movementId, suggestions }: { movementId: string; suggestions: SuggestionOption[] }) {
  const [selected, setSelected] = useState(0);
  const [pending, startTransition] = useTransition();

  if (suggestions.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin documentos pendientes con este importe</span>;
  }

  function reconcile() {
    const target = suggestions[selected];
    startTransition(async () => {
      const result = await reconcileMovement(movementId, { kind: target.kind, id: target.id });
      if (!result.ok) toast.error(result.error);
      else
        toast.success(
          target.kind === "invoice" ? `${target.label} conciliada y marcada como cobrada.` : `${target.label} conciliado y marcado como pagado.`,
        );
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {suggestions.length === 1 ? (
        <span className="max-w-56 truncate text-xs">
          <span className="font-medium">{suggestions[0].label}</span>
          <span className="text-muted-foreground"> · {suggestions[0].counterparty}</span>
        </span>
      ) : (
        <div className="w-56">
          <NativeSelect aria-label="Documento a conciliar" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
            {suggestions.map((s, i) => (
              <option key={s.id} value={i}>
                {s.label} · {s.counterparty}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <Button size="sm" disabled={pending} onClick={reconcile}>
        {pending ? <Loader2 className="animate-spin" /> : <Link2 />}
        Conciliar
      </Button>
    </div>
  );
}

export function UndoReconciliationButton({ movementId }: { movementId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Deshacer conciliación"
      title="Deshacer conciliación"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await undoReconciliation(movementId);
          if (!result.ok) toast.error(result.error);
          else toast.success("Conciliación deshecha. El documento vuelve a estar pendiente.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
    </Button>
  );
}
