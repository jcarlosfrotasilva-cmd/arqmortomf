import { db } from "@/db";
import { importacoes } from "@/db/schema";
import { nomeArquivoBackup, montarBackup, VERSAO_BACKUP } from "@/lib/server/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gera o download do backup completo do acervo e registra o evento no histórico. */
export async function GET() {
  try {
    const backup = await montarBackup();
    const nomeArquivo = nomeArquivoBackup();

    await db.insert(importacoes).values({
      arquivo: nomeArquivo,
      modo: "backup",
      totalLinhas: backup.totais.prontuarios,
      inseridos: 0,
      atualizados: 0,
      ignorados: 0,
      erros: [],
    });

    const conteudo = JSON.stringify({ ...backup, versao: VERSAO_BACKUP }, null, 2);

    return new Response(conteudo, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Content-Length": String(Buffer.byteLength(conteudo, "utf8")),
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    console.error("[backup:GET]", erro);
    return Response.json({ mensagem: "Não foi possível gerar o backup do acervo." }, { status: 500 });
  }
}
