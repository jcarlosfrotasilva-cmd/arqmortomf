import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { prontuarios } from "@/db/schema";
import { serializeProntuario } from "@/lib/server/prontuarios";
import { dadosParaBanco, validarProntuario } from "@/lib/server/validacao";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

function idValido(valor: string): number | null {
  const id = Number.parseInt(valor, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, contexto: Contexto) {
  const { id: idBruto } = await contexto.params;
  const id = idValido(idBruto);
  if (!id) return Response.json({ mensagem: "Identificador inválido." }, { status: 400 });

  try {
    const [registro] = await db.select().from(prontuarios).where(eq(prontuarios.id, id)).limit(1);
    if (!registro) {
      return Response.json({ mensagem: "Prontuário não encontrado." }, { status: 404 });
    }
    return Response.json({ prontuario: serializeProntuario(registro) });
  } catch (erro) {
    console.error("[prontuarios:GET:id]", erro);
    return Response.json({ mensagem: "Falha ao carregar o prontuário." }, { status: 500 });
  }
}

export async function PUT(request: Request, contexto: Contexto) {
  const { id: idBruto } = await contexto.params;
  const id = idValido(idBruto);
  if (!id) return Response.json({ mensagem: "Identificador inválido." }, { status: 400 });

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
    const [conflito] = await db
      .select({ id: prontuarios.id })
      .from(prontuarios)
      .where(and(eq(prontuarios.rm, dados.rm), ne(prontuarios.id, id)))
      .limit(1);

    if (conflito) {
      return Response.json(
        {
          mensagem: `O RM ${dados.rm} já pertence a outro prontuário.`,
          erros: { rm: "RM já utilizado por outro registro." },
        },
        { status: 409 },
      );
    }

    const [atualizado] = await db
      .update(prontuarios)
      .set({ ...dados, updatedAt: new Date() })
      .where(eq(prontuarios.id, id))
      .returning();

    if (!atualizado) {
      return Response.json({ mensagem: "Prontuário não encontrado." }, { status: 404 });
    }

    return Response.json({ prontuario: serializeProntuario(atualizado) });
  } catch (erro) {
    console.error("[prontuarios:PUT]", erro);
    return Response.json({ mensagem: "Não foi possível salvar as alterações." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, contexto: Contexto) {
  const { id: idBruto } = await contexto.params;
  const id = idValido(idBruto);
  if (!id) return Response.json({ mensagem: "Identificador inválido." }, { status: 400 });

  try {
    const [removido] = await db
      .delete(prontuarios)
      .where(eq(prontuarios.id, id))
      .returning({ id: prontuarios.id, rm: prontuarios.rm, nome: prontuarios.nome, sobrenome: prontuarios.sobrenome });

    if (!removido) {
      return Response.json({ mensagem: "Prontuário não encontrado." }, { status: 404 });
    }

    return Response.json({ removido });
  } catch (erro) {
    console.error("[prontuarios:DELETE]", erro);
    return Response.json({ mensagem: "Não foi possível excluir o prontuário." }, { status: 500 });
  }
}
