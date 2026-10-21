"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resetDemo } from "@/server/actions/demo";

export function ResetDemoButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await resetDemo();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Every page and any open form now point at deleted records, so a full
      // reload (not a client navigation) is the safest way to start clean.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
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
