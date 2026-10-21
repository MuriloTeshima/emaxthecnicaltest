"use client";

import { Download, FileUp, Loader2, Wand2 } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { autoReconcile, importBankCsv } from "@/server/actions/bank";

export function BankToolbar() {
  const input = useRef<HTMLInputElement>(null);
  const [importing, startImport] = useTransition();
  const [matching, startMatch] = useTransition();

  function onFile(file: File) {
    startImport(async () => {
      const result = await importBankCsv(await file.text());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { imported, duplicates, errors } = result.data;
      toast.success(
        `${imported} movimiento${imported === 1 ? "" : "s"} importado${imported === 1 ? "" : "s"}` +
          (duplicates ? `, ${duplicates} ya existía${duplicates === 1 ? "" : "n"}` : "") +
          ".",
      );
      if (errors.length) toast.warning(errors.join(" "));
    });
  }

  function onAuto() {
    startMatch(async () => {
      const result = await autoReconcile();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { reconciled, left } = result.data;
      toast.success(
        reconciled === 0
          ? "No hay coincidencias claras para conciliar automáticamente."
          : `${reconciled} movimiento${reconciled === 1 ? "" : "s"} conciliado${reconciled === 1 ? "" : "s"}.${left ? ` Quedan ${left} por revisar.` : ""}`,
      );
    });
  }

  return (
    <>
      <a href="/samples/extracto-banco.csv" download className={buttonVariants({ variant: "ghost", size: "lg" })}>
        <Download />
        CSV de ejemplo
      </a>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="lg" disabled={importing} onClick={() => input.current?.click()}>
        {importing ? <Loader2 className="animate-spin" /> : <FileUp />}
        Importar extracto
      </Button>
      <Button size="lg" disabled={matching} onClick={onAuto}>
        {matching ? <Loader2 className="animate-spin" /> : <Wand2 />}
        Conciliar automáticamente
      </Button>
    </>
  );
}
