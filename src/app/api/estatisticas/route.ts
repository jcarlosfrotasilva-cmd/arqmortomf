import { listarImportacoes, obterEstatisticas } from "@/lib/server/prontuarios";
import { respostaErro } from "@/lib/server/erros";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const incluirHistorico = url.searchParams.get("historico") === "1";
  const limite = Number.parseInt(url.searchParams.get("limite") ?? "10", 10);

  try {
    const estatisticas = await obterEstatisticas();
    if (!incluirHistorico) {
      return Response.json({ estatisticas });
    }

    const historico = await listarImportacoes(Number.isFinite(limite) ? Math.min(limite, 50) : 10);
    return Response.json({ estatisticas, historico });
  } catch (erro) {
    return respostaErro("estatisticas:GET", erro, "Não foi possível carregar os indicadores.");
  }
}
