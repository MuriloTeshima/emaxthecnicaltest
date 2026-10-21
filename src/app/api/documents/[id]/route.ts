import { getCompanyId } from "@/server/company";
import { db } from "@/server/db";

export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const { id } = await params;
  const companyId = await getCompanyId();
  const document = await db.document.findFirst({
    where: { id, companyId },
    select: { content: true, mimeType: true, fileName: true },
  });
  if (!document?.content) return new Response("Documento no encontrado", { status: 404 });

  return new Response(new Uint8Array(document.content), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
