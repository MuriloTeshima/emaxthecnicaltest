import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { type ExtractedInvoice, OcrError, type SupportedMimeType, extractedInvoiceSchema } from "./types";

const MODEL = "claude-sonnet-5-5";

const INSTRUCTIONS = `Extrae los datos de esta factura recibida por la empresa compradora (NIF del comprador: {buyerTaxId}).
El proveedor es quien EMITE la factura: no confundas sus datos con los del cliente/comprador.
Devuelve los importes en euros tal como aparecen en el documento. Si un dato no aparece, usa null; no lo inventes.`;

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractWithClaude(
  file: Buffer,
  mimeType: SupportedMimeType,
  buyerTaxId: string,
): Promise<ExtractedInvoice> {
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const data = file.toString("base64");

  const source: Anthropic.ContentBlockParam =
    mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data } };

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // Field extraction is a routine task: low effort keeps it fast and cheap.
    output_config: { effort: "low", format: zodOutputFormat(extractedInvoiceSchema) },
    messages: [
      {
        role: "user",
        content: [source, { type: "text", text: INSTRUCTIONS.replace("{buyerTaxId}", buyerTaxId) }],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new OcrError("El modelo no pudo procesar este documento.");
  if (!response.parsed_output) throw new OcrError("La respuesta del modelo no tiene el formato esperado.");
  return response.parsed_output;
}
