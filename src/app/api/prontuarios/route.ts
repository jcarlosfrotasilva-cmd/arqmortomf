import { eq } from "drizzle-orm";
import { db } from "@/db";
import { prontuarios } from "@/db/schema";
import { listarProntuarios, parseFiltros, serializeProntuario } from "@/lib/server/prontuarios";
import { dadosParaBanco, validarProntuario } from "@/lib/server/validacao";
import { respostaErro } from "@/lib/server/erros";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filtros = parseFiltros(url.searchParams);

  try {
    const lista = await listarProntuarios(filtros);
    return Response.json(lista);
  } catch (erro) {
    return respostaErro("prontuarios:GET", erro, "Não foi possível consultar os prontuários.");
  }
}

export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ mensagem: "Corpo da requisição inválido." }, { status: 400 });
  }

  const validacao = validarProntuario(corpo);
  if (!validacao.ok) {
    return Response.json(
      { mensagem: "Verifique os campos destacados.", erros: validacao.erros },
      { status: 422 },
    );
  }

  const dados = dadosParaBanco(validacao.dados);

  try {
    const [existente] = await db
      .select({ id: prontuarios.id })
      .from(prontuarios)
      .where(eq(prontuarios.rm, dados.rm))
      .limit(1);

    if (existente) {
      return Response.json(
        {
          mensagem: `Já existe um prontuário cadastrado com o RM ${dados.rm}.`,
          erros: { rm: "RM já cadastrado no arquivo morto." },
        },
        { status: 409 },
      );
    }

    const [criado] = await db
      .insert(prontuarios)
      .values(dados)
      .returning();

    return Response.json({ prontuario: serializeProntuario(criado) }, { status: 201 });
  } catch (erro) {
    return respostaErro("prontuarios:POST", erro, "Não foi possível cadastrar o prontuário.");
  }
}
