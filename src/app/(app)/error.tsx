"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-20 text-center" role="alert">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10">
        <TriangleAlert className="size-6 text-destructive" aria-hidden />
      </span>
      <div>
        <h1 className="text-xl font-semibold">Algo ha fallado</h1>
        <p className="mt-1 text-sm text-muted-foreground">No se ha podido cargar esta sección. Tus datos no se han perdido.</p>
      </div>
      <Button onClick={() => retry()}>
        <RotateCcw />
        Reintentar
      </Button>
    </div>
  );
}
