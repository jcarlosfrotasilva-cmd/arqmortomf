"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, cx, requisitar } from "@/lib/client/api";
import { Botao, Cartao, Etiqueta } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconFile,
  IconSpinner,
  IconUpload,
} from "@/components/icons";
import type { ResultadoImportacao } from "@/lib/types";

type RespostaAnalise = ResultadoImportacao & {
  aba?: string;
  avisos?: string[];
};

const EXTENSOES = [".xlsx", ".xlsm", ".csv", ".txt"];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export function ImportarView() {
  const { notificar } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<RespostaAnalise | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (file: File, simular: boolean) => {
    const formulario = new FormData();
    formulario.append("arquivo", file);

    const dados = await requisitar<RespostaAnalise>(
      `/api/importar?dryRun=${simular ? "1" : "0"}`,
      { method: "POST", body: formulario },
    );

    return dados;
  };

  const analisar = async (file: File) => {
    const nome = file.name.toLowerCase();
    if (!EXTENSOES.some((extensao) => nome.endsWith(extensao))) {
      setErro("Formato não suportado. Envie um arquivo .xlsx, .xlsm ou .csv.");
      return;
    }
    if (file.size > TAMANHO_MAXIMO) {
      setErro("Arquivo maior que 10 MB. Divida a planilha em partes menores.");
      return;
    }

    setArquivo(file);
    setResultado(null);
    setErro(null);
    setAnalisando(true);

    try {
      const dados = await enviar(file, true);
      setResultado(dados);
    } catch (falha) {
      setArquivo(null);
      setErro(falha instanceof ApiError ? falha.message : "Falha ao ler a planilha enviada.");
    } finally {
      setAnalisando(false);
    }
  };

  const confirmar = async () => {
    if (!arquivo) return;
    setConfirmando(true);
    try {
      const dados = await enviar(arquivo, false);
      setResultado(dados);
      notificar({
        tipo: "sucesso",
        titulo: "Importação concluída",
        descricao: `${dados.novos} novo(s) prontuário(s) e ${dados.atualizados} atualização(ões) gravadas no arquivo morto.`,
      });
      router.refresh();
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha na importação",
        descricao: falha instanceof ApiError ? falha.message : "Nenhum dado foi gravado.",
      });
    } finally {
      setConfirmando(false);
    }
  };

  const reiniciar = () => {
    setArquivo(null);
    setResultado(null);
    setErro(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Cartao className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">1. Envie a planilha de prontuários</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Arquivos .xlsx, .xlsm ou .csv com as colunas RM, NOME e SOBRENOME (OBSERVAÇÕES é
            opcional).
          </p>

          <div
            onDragOver={(evento) => {
              evento.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(evento) => {
              evento.preventDefault();
              setArrastando(false);
              const file = evento.dataTransfer.files?.[0];
              if (file) void analisar(file);
            }}
            className={cx(
              "mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
              arrastando
                ? "border-teal-400 bg-teal-50/60"
                : "border-slate-300 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/30",
            )}
          >
            <span
              className={cx(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                analisando ? "bg-teal-100 text-teal-600" : "bg-white text-slate-500 shadow-sm",
              )}
            >
              {analisando ? <IconSpinner /> : <IconUpload />}
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {analisando
                ? "Lendo e conferindo a planilha..."
                : "Arraste a planilha aqui ou clique para selecionar"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {arquivo ? `Arquivo atual: ${arquivo.name}` : "Limite de 10 MB por envio"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv,.txt"
              className="hidden"
              onChange={(evento) => {
                const file = evento.target.files?.[0];
                if (file) void analisar(file);
              }}
            />
            <Botao
              type="button"
              variante="secundario"
              className="mt-4"
              icone={<IconFile className="h-4 w-4" />}
              onClick={() => inputRef.current?.click()}
              disabled={analisando}
            >
              Selecionar arquivo
            </Botao>
          </div>

          {erro ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <IconAlert className="mt-0.5 h-4 w-4" />
              <span>{erro}</span>
            </div>
          ) : null}

          {analisando ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((linha) => (
                <div key={linha} className="h-4 w-full animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : null}
        </Cartao>

        <Cartao className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Orientações de preenchimento</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
            {[
              "A primeira linha da aba deve conter os títulos RM, NOME e SOBRENOME (a ordem das colunas não importa).",
              "Variações como RA, MATRÍCULA, NOME DO ALUNO, ÚLTIMO NOME e NOME DE FAMÍLIA também são reconhecidas.",
              "A coluna OBSERVAÇÕES é opcional (aceita também OBS, NOTAS e COMENTÁRIOS).",
              "Se o RM já existir no arquivo morto, o registro é atualizado com os dados da planilha.",
              "Linhas sem RM, nome ou sobrenome são listadas na conferência e não são gravadas.",
              "Nada é salvo antes da sua confirmação: primeiro mostramos a prévia da importação.",
            ].map((texto) => (
              <li key={texto} className="flex gap-2">
                <IconCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>{texto}</span>
              </li>
            ))}
          </ul>
          <a
            href="/api/modelo"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <IconDownload className="h-4 w-4" />
            Baixar modelo de planilha
          </a>
        </Cartao>
      </div>

      {resultado ? (
        <Cartao className="animar-surgir overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {resultado.confirmada ? "Importação concluída" : "2. Confira a importação"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {resultado.arquivo} · aba tratada: {resultado.aba ?? "principal"} ·{" "}
                {resultado.totalLinhas} linha(s) de dados lidas
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Etiqueta tom="slate">{resultado.linhasValidas} válida(s)</Etiqueta>
              <Etiqueta tom="teal">{resultado.novos} novo(s)</Etiqueta>
              <Etiqueta tom="amber">{resultado.atualizados} atualização(ões)</Etiqueta>
              <Etiqueta tom={resultado.ignorados > 0 ? "rose" : "emerald"}>
                {resultado.ignorados} ignorada(s)
              </Etiqueta>
            </div>
          </div>

          {resultado.confirmada ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
              <IconCheck className="h-5 w-5" />
              <span>
                {resultado.novos} prontuário(s) cadastrado(s) e {resultado.atualizados} atualizado(s).
                {resultado.importacaoId ? ` Registro de auditoria #${resultado.importacaoId}.` : ""}
              </span>
              <Link
                href="/"
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Ir para a consulta
              </Link>
            </div>
          ) : null}

          {resultado.avisos && resultado.avisos.length > 0 ? (
            <ul className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800">
              {resultado.avisos.map((aviso) => (
                <li key={aviso} className="flex gap-2 py-0.5">
                  <IconAlert className="mt-0.5 h-3.5 w-3.5" />
                  <span>{aviso}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {resultado.previa.length > 0 ? (
            <div className="tabela-rolagem max-h-[26rem] overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Linha</th>
                    <th className="px-4 py-2.5 font-semibold">RM</th>
                    <th className="px-4 py-2.5 font-semibold">Nome</th>
                    <th className="px-4 py-2.5 font-semibold">Sobrenome</th>
                    <th className="px-4 py-2.5 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultado.previa.map((linha) => (
                    <tr key={`${linha.linha}-${linha.rm}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2 text-xs text-slate-400">{linha.linha}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{linha.rm}</td>
                      <td className="px-4 py-2 text-slate-900">{linha.nome}</td>
                      <td className="px-4 py-2 text-slate-700">{linha.sobrenome}</td>
                      <td className="px-4 py-2">
                        <Etiqueta tom={linha.situacao === "novo" ? "emerald" : "amber"}>
                          {linha.situacao === "novo" ? "Novo cadastro" : "Atualização"}
                        </Etiqueta>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultado.linhasValidas > resultado.previa.length ? (
                <p className="bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  Exibindo as primeiras {resultado.previa.length} de {resultado.linhasValidas}{" "}
                  linhas válidas.
                </p>
              ) : null}
            </div>
          ) : null}

          {resultado.erros.length > 0 ? (
            <details className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                {resultado.erros.length} linha(s) ignorada(s) — ver detalhes
              </summary>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto pr-2 text-xs text-slate-600">
                {resultado.erros.map((item) => (
                  <li key={`${item.linha}-${item.mensagem}`} className="flex gap-2">
                    <span className="min-w-16 font-mono text-slate-400">linha {item.linha}</span>
                    <span>{item.mensagem}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
            <p className="text-xs text-slate-500">
              {resultado.confirmada
                ? "Os dados já estão disponíveis na consulta de prontuários."
                : "Nenhum dado foi gravado ainda. Confirme para efetivar a importação."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Botao type="button" variante="secundario" onClick={reiniciar} disabled={confirmando}>
                {resultado.confirmada ? "Importar outra planilha" : "Escolher outro arquivo"}
              </Botao>
              {!resultado.confirmada ? (
                <Botao
                  type="button"
                  variante="primario"
                  carregando={confirmando}
                  icone={<IconCheck className="h-4 w-4" />}
                  onClick={() => void confirmar()}
                >
                  Confirmar importação ({resultado.linhasValidas})
                </Botao>
              ) : null}
            </div>
          </div>
        </Cartao>
      ) : null}
    </div>
  );
}
