import { erroTransitorio } from "@/db";

/** Mensagem amigável + diagnóstico técnico para falhas em rotas de API. */
export function respostaErro(
  rotulo: string,
  erro: unknown,
  mensagem: string,
  status?: number,
): Response {
  console.error(`[${rotulo}]`, erro);

  const detalhe = erro instanceof Error ? erro.message : String(erro ?? "erro desconhecido");
  const indisponivel =
    erroTransitorio(erro) || /connect|connection|econnrefused|timeout/i.test(detalhe);

  return Response.json(
    {
      mensagem: indisponivel
        ? "O banco de dados não respondeu agora. Aguarde alguns segundos e tente novamente — se persistir, confira a variável DATABASE_URL e o status do servidor PostgreSQL."
        : mensagem,
      detalhe,
      tipo: indisponivel ? "banco-indisponivel" : "erro-interno",
    },
    { status: status ?? 500 },
  );
}
