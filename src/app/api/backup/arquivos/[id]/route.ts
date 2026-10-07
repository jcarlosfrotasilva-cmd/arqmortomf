import { excluirBackupSalvo, obterBackupSalvo } from "@/lib/server/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

function idValido(valor: string): number | null {
  const id = Number.parseInt(valor, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Devolve o conteúdo da cópia guardada (usado para visualizar, baixar e restaurar). */
export async function GET(request: Request, contexto: Contexto) {
  const { id: idBruto } = await contexto.params;
  const id = idValido(idBruto);
  if (!id) return Response.json({ mensagem: "Identificador inválido." }, { status: 400 });

  const url = new URL(request.url);
  const embutido = url.searchParams.get("embutido") === "1";

  try {
    const salvo = await obterBackupSalvo(id);
    if (!salvo) {
      return Response.json({ mensagem: "Cópia de segurança não encontrada." }, { status: 404 });
    }

    const cabecalhos: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(Buffer.byteLength(salvo.conteudo, "utf8")),
      "Cache-Control": "no-store",
      "X-Nome-Arquivo": salvo.nome,
    };
    if (!embutido) {
      cabecalhos["Content-Disposition"] = `attachment; filename="${salvo.nome}"`;
    }

    return new Response(salvo.conteudo, { headers: cabecalhos });
  } catch (erro) {
    console.error("[backup:arquivos:GET:id]", erro);
    return Response.json({ mensagem: "Não foi possível abrir a cópia de segurança." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, contexto: Contexto) {
  const { id: idBruto } = await contexto.params;
  const id = idValido(idBruto);
  if (!id) return Response.json({ mensagem: "Identificador inválido." }, { status: 400 });

  try {
    const removido = await excluirBackupSalvo(id);
    if (!removido) {
      return Response.json({ mensagem: "Cópia de segurança não encontrada." }, { status: 404 });
    }
    return Response.json({ removido: true });
  } catch (erro) {
    console.error("[backup:arquivos:DELETE]", erro);
    return Response.json({ mensagem: "Não foi possível excluir a cópia." }, { status: 500 });
  }
}
