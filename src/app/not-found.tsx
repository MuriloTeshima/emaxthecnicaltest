import { NotFoundMessage } from "@/components/not-found-message";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center">
      <NotFoundMessage />
    </main>
  );
}
