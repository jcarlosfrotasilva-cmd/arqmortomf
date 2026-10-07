import {
  listarBackupsSalvos,
  salvarBackupNoSistema,
} from "@/lib/server/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista as cópias de segurança guardadas dentro do sistema. */
export async function GET() {
  try {
    const backups = await listarBackupsSalvos(20);
    return Response.json({ backups });
  } catch (erro) {
    console.error("[backup:arquivos:GET]", erro);
    return Response.json({ mensagem: "Não foi possível listar as cópias guardadas." }, { status: 500 });
  }
}

/** Gera e guarda uma nova cópia de segurança no sistema (sem depender de download). */
export async function POST() {
  try {
    const backup = await salvarBackupNoSistema();
    return Response.json({ backup }, { status: 201 });
  } catch (erro) {
    console.error("[backup:arquivos:POST]", erro);
    return Response.json({ mensagem: "Não foi possível guardar a cópia no sistema." }, { status: 500 });
  }
}
