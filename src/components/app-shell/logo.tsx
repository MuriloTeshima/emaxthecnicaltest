import { Zap } from "lucide-react";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Zap className="size-4" aria-hidden />
      </span>
      <span className="text-base">
        Ener<span className="text-primary">Factura</span>
      </span>
    </Link>
  );
}
