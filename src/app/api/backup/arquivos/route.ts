import {
  listarBackupsSalvos,
  salvarBackupNoSistema,
} from "@/lib/server/backup";
import { respostaErro } from "@/lib/server/erros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista as cópias de segurança guardadas dentro do sistema. */
export async function GET() {
  try {
    const backups = await listarBackupsSalvos(20);
    return Response.json({ backups });
  } catch (erro) {
    return respostaErro("backup:arquivos:GET", erro, "Não foi possível listar as cópias guardadas.");
  }
}

/** Gera e guarda uma nova cópia de segurança no sistema (sem depender de download). */
export async function POST() {
  try {
    const backup = await salvarBackupNoSistema();
    return Response.json({ backup }, { status: 201 });
  } catch (erro) {
    return respostaErro("backup:arquivos:POST", erro, "Não foi possível guardar a cópia no sistema.");
  }
}
