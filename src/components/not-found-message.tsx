import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundMessage() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted">
        <FileQuestion className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <h1 className="text-xl font-semibold">Página no encontrada</h1>
        <p className="mt-1 text-sm text-muted-foreground">El enlace no existe o el documento se ha eliminado.</p>
      </div>
      <Link href="/" className={buttonVariants()}>
        Volver al inicio
      </Link>
    </div>
  );
}
