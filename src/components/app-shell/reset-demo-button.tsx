"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resetDemo } from "@/server/actions/demo";

export function ResetDemoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await resetDemo();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("Datos de demostración restablecidos.");
      router.push("/");
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => setOpen(true)}>
        <RotateCcw />
        Restablecer datos demo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Restablecer los datos?</DialogTitle>
            <DialogDescription>
              Se borrarán las facturas, gastos y contactos actuales y se cargarán de nuevo los datos de ejemplo (casos A, B y C).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
