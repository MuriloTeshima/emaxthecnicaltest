"use client";

import { FileUp, Loader2, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/generated/prisma/browser";
import { cn } from "@/lib/utils";
import type { OcrResponse } from "@/server/ocr/response";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_BYTES = 4 * 1024 * 1024;

const PROVIDER_LABELS: Record<OcrResponse["provider"], string> = {
  claude: "Datos extraídos con IA (Claude). Revísalos antes de guardar.",
  "local-pdf": "Datos extraídos del texto del PDF. Revísalos antes de guardar.",
  "local-tesseract": "Datos extraídos con OCR local. Revísalos antes de guardar.",
};

type State =
  | { status: "idle"; error?: string }
  | { status: "processing"; file: File }
  | { status: "done"; file: File; result: OcrResponse };

export function ExpenseUpload({ suppliers, today }: { suppliers: Contact[]; today: string }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  async function upload(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) {
      setState({ status: "idle", error: "Formato no admitido. Sube un PDF, JPG, PNG o WEBP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ status: "idle", error: "El archivo supera los 4 MB." });
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setState({ status: "processing", file });

    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/ocr", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) {
        setState({ status: "idle", error: json.error ?? "No se ha podido procesar el documento." });
        return;
      }
      setState({ status: "done", file, result: json as OcrResponse });
    } catch {
      setState({ status: "idle", error: "Error de conexión. Inténtalo de nuevo." });
    }
  }

  function reset() {
    setPreviewUrl(null);
    setState({ status: "idle" });
  }

  if (state.status !== "done") {
    const processing = state.status === "processing";
    return (
      <div className="flex flex-col gap-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && !processing) upload(file);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/40",
            processing && "pointer-events-none opacity-80",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={processing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            {processing ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
          </span>
          {processing ? (
            <>
              <p className="font-medium">Leyendo {state.file.name}…</p>
              <p className="text-sm text-muted-foreground">Extrayendo proveedor, fechas e importes. Suele tardar unos segundos.</p>
            </>
          ) : (
            <>
              <p className="font-medium">Arrastra aquí la factura o haz clic para elegirla</p>
              <p className="text-sm text-muted-foreground">PDF o foto (JPG, PNG, WEBP) · máximo 4 MB</p>
            </>
          )}
        </label>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes una factura a mano? Descarga un ejemplo:{" "}
          <a href="/samples/factura-profesional.pdf" download className="font-medium text-primary hover:underline">
            factura en PDF
          </a>{" "}
          o{" "}
          <a href="/samples/ticket-gasolinera.png" download className="font-medium text-primary hover:underline">
            foto de un ticket
          </a>
          .
        </p>
        {state.status === "idle" && state.error && (
          <p className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            <TriangleAlert className="size-4 shrink-0" />
            {state.error}
          </p>
        )}
      </div>
    );
  }

  const { result, file } = state;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <strong>{file.name}</strong> procesado. {PROVIDER_LABELS[result.provider]}
            {result.notice && <span className="block text-amber-700">{result.notice}</span>}
          </span>
        </p>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw />
          Subir otra
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_1fr]">
        {previewUrl && (
          <div className="overflow-hidden rounded-xl border bg-muted/30 xl:sticky xl:top-8 xl:self-start">
            {file.type === "application/pdf" ? (
              <iframe src={previewUrl} title="Vista previa de la factura" className="h-80 w-full xl:h-[36rem]" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Vista previa de la factura" className="max-h-[36rem] w-full object-contain" />
            )}
          </div>
        )}
        <ExpenseForm
          key={result.documentId}
          suppliers={
            result.supplier && !suppliers.some((s) => s.id === result.supplier!.id)
              ? [...suppliers, result.supplier].sort((a, b) => a.name.localeCompare(b.name, "es"))
              : suppliers
          }
          today={today}
          initial={result.initial}
          detectedSupplier={result.detectedSupplier ?? undefined}
          warnings={result.warnings}
          documentId={result.documentId}
          submitLabel="Confirmar y guardar"
        />
      </div>
    </div>
  );
}
