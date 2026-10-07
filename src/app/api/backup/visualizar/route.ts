import { db } from "@/db";
import { importacoes } from "@/db/schema";
import { montarBackup, nomeArquivoBackup } from "@/lib/server/backup";
import { respostaErro } from "@/lib/server/erros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devolve o conteúdo do backup para exibição/uso dentro do navegador (sem forçar
 * download). Com `?registrar=1`, o evento é gravado no histórico de auditoria.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const registrar = url.searchParams.get("registrar") === "1";

  try {
    const backup = await montarBackup();
    const nomeArquivo = nomeArquivoBackup();

    if (registrar) {
      await db.insert(importacoes).values({
        arquivo: nomeArquivo,
        modo: "backup",
        totalLinhas: backup.totais.prontuarios,
        inseridos: 0,
        atualizados: 0,
        ignorados: 0,
        erros: [],
      });
    }

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Nome-Arquivo": nomeArquivo,
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    return respostaErro("backup:visualizar", erro, "Não foi possível montar o backup do acervo.");
  }
}
