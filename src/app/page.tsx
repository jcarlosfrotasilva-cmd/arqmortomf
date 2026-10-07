import { AppShell } from "@/components/AppShell";
import { ConsultaView } from "@/components/ConsultaView";

export const dynamic = "force-dynamic";

export default function PaginaConsulta() {
  return (
    <AppShell
      titulo="Consulta de prontuários"
      subtitulo="Pesquise o arquivo morto por nome e sobrenome, edite dados de localização e mantenha o acervo atualizado."
    >
      <ConsultaView />
    </AppShell>
  );
}
