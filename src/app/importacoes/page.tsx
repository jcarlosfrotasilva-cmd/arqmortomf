import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Cartao, Etiqueta, Vazio } from "@/components/ui";
import { IconHistory, IconUpload } from "@/components/icons";
import { listarImportacoes } from "@/lib/server/prontuarios";
import { formatDateTime } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function PaginaImportacoes() {
  const historico = await listarImportacoes(50, [
    "importacao",
    "restauracao-mesclar",
    "restauracao-total",
  ]).catch(() => []);
  const totais = historico.reduce(
    (acumulado, item) => ({
      inseridos: acumulado.inseridos + item.inseridos,
      atualizados: acumulado.atualizados + item.atualizados,
      ignorados: acumulado.ignorados + item.ignorados,
    }),
    { inseridos: 0, atualizados: 0, ignorados: 0 },
  );

  return (
    <AppShell
      titulo="Histórico de importações"
      subtitulo="Rastreabilidade de cada planilha processada: o que foi cadastrado, atualizado e o que precisa de correção."
      acoes={
        <Link
          href="/importar"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 transition hover:bg-teal-700"
        >
          <IconUpload className="h-4 w-4" />
          Importar planilha
        </Link>
      }
    >
      {historico.length === 0 ? (
        <Cartao>
          <Vazio
            icone={<IconHistory className="h-6 w-6" />}
            titulo="Nenhuma importação registrada"
            descricao="Quando uma planilha de prontuários for importada, o resumo de cada envio aparecerá aqui com as linhas ignoradas e o motivo."
            acao={
              <Link
                href="/importar"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                <IconUpload className="h-4 w-4" />
                Importar a primeira planilha
              </Link>
            }
          />
        </Cartao>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Cartao className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Prontuários cadastrados
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{totais.inseridos}</p>
            </Cartao>
            <Cartao className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Registros atualizados
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{totais.atualizados}</p>
            </Cartao>
            <Cartao className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Linhas com pendência
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{totais.ignorados}</p>
            </Cartao>
          </div>

          <div className="space-y-4">
            {historico.map((importacao) => (
              <Cartao key={importacao.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {importacao.arquivo}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Enviado em {formatDateTime(importacao.createdAt)} ·{" "}
                      {importacao.totalLinhas} linha(s) lidas
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Etiqueta tom={importacao.modo.startsWith("restauracao") ? "amber" : "slate"}>
                      {importacao.modo === "restauracao-total"
                        ? "Restauração (substituir)"
                        : importacao.modo === "restauracao-mesclar"
                          ? "Restauração (mesclar)"
                          : "Importação"}
                    </Etiqueta>
                    <Etiqueta tom="teal">{importacao.inseridos} novo(s)</Etiqueta>
                    <Etiqueta tom="amber">{importacao.atualizados} atualização(ões)</Etiqueta>
                    <Etiqueta tom={importacao.ignorados > 0 ? "rose" : "emerald"}>
                      {importacao.ignorados} ignorada(s)
                    </Etiqueta>
                  </div>
                </div>

                {importacao.erros.length > 0 ? (
                  <details className="border-t border-slate-200 bg-slate-50 px-5 py-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                      Detalhes das linhas ignoradas
                    </summary>
                    <ul className="mt-2 max-h-56 space-y-1 overflow-auto pr-2 text-xs text-slate-600">
                      {importacao.erros.map((erro) => (
                        <li key={`${importacao.id}-${erro.linha}-${erro.mensagem}`} className="flex gap-2">
                          <span className="min-w-16 font-mono text-slate-400">linha {erro.linha}</span>
                          <span>{erro.mensagem}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </Cartao>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
