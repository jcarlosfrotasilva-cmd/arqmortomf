import { AppShell } from "@/components/AppShell";
import { BancoPanel } from "@/components/BancoPanel";
import { BackupView } from "@/components/BackupView";
import { obterInfoBanco } from "@/lib/server/diagnostico";
import { listarBackupsSalvos } from "@/lib/server/backup";
import { obterEstatisticas, listarImportacoes } from "@/lib/server/prontuarios";

export const dynamic = "force-dynamic";

export default async function PaginaBackup() {
  const [estatisticas, historico, copiasSalvas, infoBanco] = await Promise.all([
    obterEstatisticas(),
    listarImportacoes(12, ["backup", "restauracao-mesclar", "restauracao-total"]),
    listarBackupsSalvos(20),
    obterInfoBanco(),
  ]);

  return (
    <AppShell
      titulo="Backup e restauração"
      subtitulo="Gere cópias de segurança do arquivo morto e restaure o acervo a partir de um backup do sistema ou de uma planilha de prontuários."
    >
      <div className="space-y-6">
        <BackupView
          estatisticas={estatisticas}
          historico={historico}
          copiasSalvas={copiasSalvas}
        />
        <BancoPanel info={infoBanco} />
      </div>
    </AppShell>
  );
}
