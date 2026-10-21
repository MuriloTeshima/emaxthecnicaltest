"use client";

import { Building2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ContactDialog } from "@/components/contacts/contact-dialog";
import { Button } from "@/components/ui/button";

export function NewContactButtons() {
  const router = useRouter();
  const [kind, setKind] = useState<"CLIENT" | "SUPPLIER" | null>(null);

  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setKind("SUPPLIER")}>
        <Truck />
        Nuevo proveedor
      </Button>
      <Button size="lg" onClick={() => setKind("CLIENT")}>
        <Building2 />
        Nuevo cliente
      </Button>
      {kind && (
        <ContactDialog
          key={kind}
          open
          onOpenChange={(open) => !open && setKind(null)}
          kind={kind}
          onCreated={() => router.refresh()}
        />
      )}
    </>
  );
}
