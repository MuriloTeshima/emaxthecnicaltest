import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "EnerFactura", template: "%s · EnerFactura" },
  description: "Facturación y contabilidad para autónomos y pymes.",
  // The UI is Spanish by design. Browser translation rewrites React-owned text
  // nodes and makes later updates crash, so opt out of it.
  other: { google: "notranslate" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" translate="no" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster richColors position="bottom-right" containerAriaLabel="Notificaciones" toastOptions={{ closeButtonAriaLabel: "Cerrar aviso" }} />
      </body>
    </html>
  );
}
