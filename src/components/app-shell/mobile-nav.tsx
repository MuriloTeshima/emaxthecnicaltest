"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { ResetDemoButton } from "./reset-demo-button";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Abrir menú" />}>
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-4">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle render={<div />}>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <NavLinks onNavigate={() => setOpen(false)} />
        <div className="mt-auto">
          <ResetDemoButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
