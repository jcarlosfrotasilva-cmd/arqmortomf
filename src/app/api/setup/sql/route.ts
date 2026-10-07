import { NOME_ARQUIVO_SQL, SCRIPT_SCHEMA_SQL } from "@/lib/sql/schema";

export const dynamic = "force-dynamic";

/**
 * Entrega o script SQL de criação das tabelas.
 * - Sem parâmetro: exibe o texto (para copiar direto na tela).
 * - `?baixar=1`: força o download do arquivo .sql.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const baixar = url.searchParams.get("baixar") === "1";

  const cabecalhos: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": String(Buffer.byteLength(SCRIPT_SCHEMA_SQL, "utf8")),
    "Cache-Control": "no-store",
    "X-Nome-Arquivo": NOME_ARQUIVO_SQL,
  };
  if (baixar) {
    cabecalhos["Content-Disposition"] = `attachment; filename="${NOME_ARQUIVO_SQL}"`;
  }

  return new Response(SCRIPT_SCHEMA_SQL, { headers: cabecalhos });
}
