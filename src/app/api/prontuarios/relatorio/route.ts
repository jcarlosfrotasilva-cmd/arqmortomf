import { listarProntuariosParaExportacao, parseFiltros } from "@/lib/server/prontuarios";
import { respostaErro } from "@/lib/server/erros";

export const dynamic = "force-dynamic";

/** Relação completa de prontuários (sem paginação) para impressão em papel. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filtros = parseFiltros(url.searchParams);

  try {
    const itens = await listarProntuariosParaExportacao(filtros, 20000);
    return Response.json({
      itens,
      total: itens.length,
      geradoEm: new Date().toISOString(),
      filtros: {
        nome: filtros.nome,
        sobrenome: filtros.sobrenome,
        rm: filtros.rm,
        ordenarPor: filtros.ordenarPor,
        direcao: filtros.direcao,
      },
    });
  } catch (erro) {
    return respostaErro("relatorio:GET", erro, "Não foi possível gerar a relação para impressão.");
  }
}
