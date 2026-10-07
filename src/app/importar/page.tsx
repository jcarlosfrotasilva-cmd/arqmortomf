import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ImportarView } from "@/components/ImportarView";
import { Cartao, Etiqueta } from "@/components/ui";
import { IconHistory } from "@/components/icons";
import { listarImportacoes } from "@/lib/server/prontuarios";
import { formatDateTime } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function PaginaImportar() {
  const historico = await listarImportacoes(4, [
    "importacao",
    "restauracao-mesclar",
    "restauracao-total",
  ]).catch(() => []);

  return (
    <AppShell
      titulo="Importar planilha de prontuários"
      subtitulo="Cadastre o arquivo morto em lote a partir de uma planilha Excel com RM, nome e sobrenome — com conferência antes de gravar."
    >
      <div className="space-y-6">
        <ImportarView />

        <Cartao className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <IconHistory className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Últimos envios</h2>
            </div>
            <Link
              href="/importacoes"
              className="text-xs font-semibold text-teal-600 underline-offset-4 hover:underline"
            >
              Ver histórico completo
            </Link>
          </div>

          {historico.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Nenhuma planilha importada até o momento.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {historico.map((importacao) => (
                <li key={importacao.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {importacao.arquivo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(importacao.createdAt)} · {importacao.totalLinhas} linha(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {importacao.modo.startsWith("restauracao") ? (
                      <Etiqueta tom="amber">Restauração</Etiqueta>
                    ) : null}
                    <Etiqueta tom="teal">{importacao.inseridos} novo(s)</Etiqueta>
                    <Etiqueta tom="amber">{importacao.atualizados} atualizado(s)</Etiqueta>
                    <Etiqueta tom={importacao.ignorados > 0 ? "rose" : "emerald"}>
                      {importacao.ignorados} ignorado(s)
                    </Etiqueta>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </AppShell>
  );
}
