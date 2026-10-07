import { normalizarLetra, obterIndiceLetras } from "@/lib/server/prontuarios";
import type { CampoIndice } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Índice alfabético com a contagem de prontuários por letra inicial. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const campo: CampoIndice = url.searchParams.get("campo") === "nome" ? "nome" : "sobrenome";

  try {
    const { letras, total } = await obterIndiceLetras(
      {
        nome: (url.searchParams.get("nome") ?? "").trim(),
        sobrenome: (url.searchParams.get("sobrenome") ?? "").trim(),
        rm: (url.searchParams.get("rm") ?? "").trim(),
      },
      campo,
    );

    return Response.json({
      campo,
      letraAtiva: normalizarLetra(url.searchParams.get("letra")).toUpperCase(),
      total,
      letras,
    });
  } catch (erro) {
    console.error("[prontuarios:indice]", erro);
    return Response.json({ mensagem: "Não foi possível montar o índice alfabético." }, { status: 500 });
  }
}
