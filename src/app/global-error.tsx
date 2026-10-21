"use client";

import "./globals.css";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body className="grid min-h-screen place-items-center p-6 text-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Algo ha fallado</h1>
          <p className="text-sm text-muted-foreground">La aplicación no ha podido cargarse. Inténtalo de nuevo en unos segundos.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
