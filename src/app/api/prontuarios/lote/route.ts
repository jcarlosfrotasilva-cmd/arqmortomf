import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { prontuarios } from "@/db/schema";
import { validarIds } from "@/lib/server/validacao";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ mensagem: "Corpo da requisição inválido." }, { status: 400 });
  }

  const ids = validarIds((corpo as { ids?: unknown } | null)?.ids);
  if (!ids) {
    return Response.json({ mensagem: "Selecione ao menos um prontuário." }, { status: 422 });
  }

  try {
    const removidos = await db
      .delete(prontuarios)
      .where(inArray(prontuarios.id, ids))
      .returning({ id: prontuarios.id });

    return Response.json({ removidos: removidos.length });
  } catch (erro) {
    console.error("[prontuarios:lote:DELETE]", erro);
    return Response.json({ mensagem: "Não foi possível excluir os prontuários selecionados." }, { status: 500 });
  }
}
