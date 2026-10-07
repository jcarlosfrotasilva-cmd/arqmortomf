"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ApiError, cx, requisitar } from "@/lib/client/api";
import { Botao, Cartao, Etiqueta, Rotulo } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  IconAlert,
  IconCheck,
  IconCopy,
  IconDownload,
  IconEye,
  IconFile,
  IconRestore,
  IconShield,
  IconSpinner,
  IconTrash,
  IconUpload,
} from "@/components/icons";
import { Modal } from "@/components/ui";
import { formatDateTime } from "@/lib/text";
import type {
  BackupSalvo,
  Estatisticas,
  RegistroImportacao,
  ResultadoRestauracao,
} from "@/lib/types";
import { formatDate } from "@/lib/text";

const EXTENSOES = [".json", ".xlsx", ".xlsm", ".csv", ".txt"];
const TAMANHO_MAXIMO = 25 * 1024 * 1024;

const ROTULOS_MODO: Record<string, string> = {
  backup: "Backup gerado",
  "restauracao-mesclar": "Restauração (mesclar)",
  "restauracao-total": "Restauração (substituir)",
  importacao: "Importação de planilha",
};

type ArquivoHandle = {
  createWritable: () => Promise<{
    write: (dados: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type JanelaComFilePicker = Window & {
  showSaveFilePicker?: (opcoes?: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<ArquivoHandle>;
};

export function BackupView({
  estatisticas,
  historico,
  copiasSalvas,
}: {
  estatisticas: Estatisticas;
  historico: RegistroImportacao[];
  copiasSalvas: BackupSalvo[];
}) {
  const { notificar } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [modo, setModo] = useState<"mesclar" | "substituir">("mesclar");
  const [resultado, setResultado] = useState<ResultadoRestauracao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerandoCopia, setGerandoCopia] = useState(false);
  const [salvandoSistema, setSalvandoSistema] = useState(false);
  const [copia, setCopia] = useState<{ nomeArquivo: string; conteudo: string } | null>(null);
  const [backupSistemaId, setBackupSistemaId] = useState<number | null>(null);
  const [nomeOrigemSistema, setNomeOrigemSistema] = useState<string | null>(null);

  const gerarCopia = async (baixar: boolean) => {
    setGerandoCopia(true);
    try {
      const resposta = await fetch("/api/backup/visualizar?registrar=1", { cache: "no-store" });
      if (!resposta.ok) throw new Error("Não foi possível montar o backup.");

      const conteudo = await resposta.text();
      const nomeArquivo = resposta.headers.get("X-Nome-Arquivo") ?? "backup-arquivo-morto.json";

      setCopia({ nomeArquivo, conteudo });
      if (baixar) salvarArquivo(nomeArquivo, conteudo);
      else notificar({ tipo: "info", titulo: "Backup pronto na tela", descricao: nomeArquivo });
      if (baixar) notificar({ tipo: "sucesso", titulo: "Backup baixado", descricao: nomeArquivo });
      router.refresh();
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha ao gerar o backup",
        descricao: falha instanceof Error ? falha.message : "Tente novamente em instantes.",
      });
    } finally {
      setGerandoCopia(false);
    }
  };

  const obterConteudoBackup = async (registrar: boolean) => {
    const resposta = await fetch(`/api/backup/visualizar${registrar ? "?registrar=1" : ""}`, {
      cache: "no-store",
    });
    if (!resposta.ok) throw new Error("Não foi possível montar o backup.");
    const conteudo = await resposta.text();
    const nomeArquivo = resposta.headers.get("X-Nome-Arquivo") ?? "backup-arquivo-morto.json";
    return { nomeArquivo, conteudo };
  };

  /** Abre o diálogo “Salvar como” do próprio sistema operacional (Chrome/Edge). */
  const salvarNoComputador = async () => {
    setGerandoCopia(true);
    try {
      const { nomeArquivo, conteudo } = await obterConteudoBackup(true);
      const janela = window as JanelaComFilePicker;

      if (typeof janela.showSaveFilePicker === "function") {
        try {
          const handle = await janela.showSaveFilePicker({
            suggestedName: nomeArquivo,
            types: [
              { description: "Backup do arquivo morto (.json)", accept: { "application/json": [".json"] } },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(conteudo);
          await writable.close();
          notificar({
            tipo: "sucesso",
            titulo: "Backup salvo no computador",
            descricao: `${nomeArquivo} · ${(new Blob([conteudo]).size / 1024).toFixed(1)} KB`,
          });
          router.refresh();
          return;
        } catch (falha) {
          if (falha instanceof DOMException && falha.name === "AbortError") return;
          /* segue para o download tradicional */
        }
      }

      setCopia({ nomeArquivo, conteudo });
      salvarArquivo(nomeArquivo, conteudo);
      notificar({
        tipo: "info",
        titulo: "Download iniciado pelo navegador",
        descricao:
          "Se o arquivo não aparecer, use “Copiar conteúdo” na janela aberta ou “Guardar cópia no sistema”.",
      });
      router.refresh();
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha ao salvar o backup",
        descricao: falha instanceof Error ? falha.message : "Tente novamente em instantes.",
      });
    } finally {
      setGerandoCopia(false);
    }
  };

  /** Guarda uma cópia dentro do próprio sistema (não depende de download). */
  const guardarNoSistema = async () => {
    setSalvandoSistema(true);
    try {
      const resposta = await requisitar<{ backup: BackupSalvo }>("/api/backup/arquivos", {
        method: "POST",
      });
      notificar({
        tipo: "sucesso",
        titulo: "Cópia guardada no sistema",
        descricao: `${resposta.backup.nome} · ${resposta.backup.totalRegistros} registro(s). Você pode restaurar por aqui mesmo.`,
      });
      router.refresh();
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha ao guardar a cópia",
        descricao: falha instanceof Error ? falha.message : "Tente novamente em instantes.",
      });
    } finally {
      setSalvandoSistema(false);
    }
  };

  const verCopiaDoSistema = async (item: BackupSalvo) => {
    try {
      const resposta = await fetch(`/api/backup/arquivos/${item.id}?embutido=1`, {
        cache: "no-store",
      });
      if (!resposta.ok) throw new Error("Cópia não encontrada.");
      setCopia({ nomeArquivo: item.nome, conteudo: await resposta.text() });
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Não foi possível abrir a cópia",
        descricao: falha instanceof Error ? falha.message : undefined,
      });
    }
  };

  const excluirCopiaDoSistema = async (item: BackupSalvo) => {
    try {
      await requisitar<{ removido: boolean }>(`/api/backup/arquivos/${item.id}`, {
        method: "DELETE",
      });
      if (backupSistemaId === item.id) reiniciar();
      notificar({ tipo: "sucesso", titulo: "Cópia excluída", descricao: item.nome });
      router.refresh();
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha ao excluir a cópia",
        descricao: falha instanceof Error ? falha.message : undefined,
      });
    }
  };

  const salvarArquivo = (nomeArquivo: string, conteudo: string) => {
    const blob = new Blob([conteudo], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const copiarCopia = async () => {
    if (!copia) return;
    try {
      await navigator.clipboard.writeText(copia.conteudo);
      notificar({
        tipo: "sucesso",
        titulo: "Backup copiado",
        descricao: "Cole em um arquivo de texto e salve com a extensão .json.",
      });
      return;
    } catch {
      /* segue para o modo alternativo */
    }

    try {
      const area = document.createElement("textarea");
      area.value = copia.conteudo;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      notificar({ tipo: "sucesso", titulo: "Backup copiado para a área de transferência." });
    } catch {
      notificar({
        tipo: "erro",
        titulo: "O navegador bloqueou a cópia automática",
        descricao: "Selecione o texto na janela e use Ctrl+C (ou Cmd+C).",
      });
    }
  };

  const ultimoBackup = historico.find((item) => item.modo === "backup") ?? null;
  const ultimaRestauracao = historico.find((item) => item.modo.startsWith("restauracao")) ?? null;

  const enviar = async (
    origem: { file?: File; backupId?: number },
    selecionado: "mesclar" | "substituir",
    simular: boolean,
  ) => {
    const formulario = new FormData();
    if (origem.file) formulario.append("arquivo", origem.file);
    if (origem.backupId) formulario.append("backupId", String(origem.backupId));
    return requisitar<ResultadoRestauracao>(
      `/api/backup/restaurar?modo=${selecionado}&dryRun=${simular ? "1" : "0"}`,
      { method: "POST", body: formulario },
    );
  };

  const origemAtual = (): { file?: File; backupId?: number } =>
    arquivo ? { file: arquivo } : backupSistemaId ? { backupId: backupSistemaId } : {};

  const analisarCopiaDoSistema = async (copia: BackupSalvo) => {
    setArquivo(null);
    setBackupSistemaId(copia.id);
    setNomeOrigemSistema(copia.nome);
    setResultado(null);
    setErro(null);
    setAnalisando(true);
    try {
      setResultado(await enviar({ backupId: copia.id }, modo, true));
      notificar({
        tipo: "info",
        titulo: "Cópia do sistema carregada",
        descricao: `${copia.nome} · ${copia.totalRegistros} registro(s). Confira a prévia abaixo.`,
      });
    } catch (falha) {
      setBackupSistemaId(null);
      setErro(falha instanceof ApiError ? falha.message : "Falha ao abrir a cópia guardada.");
    } finally {
      setAnalisando(false);
    }
  };

  const analisar = async (file: File) => {
    const nome = file.name.toLowerCase();
    if (!EXTENSOES.some((extensao) => nome.endsWith(extensao))) {
      setErro("Formato não suportado. Envie o backup .json gerado pelo sistema ou uma planilha .xlsx/.xlsm/.csv.");
      return;
    }
    if (file.size > TAMANHO_MAXIMO) {
      setErro("Arquivo maior que 25 MB.");
      return;
    }

    setArquivo(file);
    setResultado(null);
    setErro(null);
    setAnalisando(true);

    try {
      setResultado(await enviar({ file }, modo, true));
    } catch (falha) {
      setArquivo(null);
      setErro(falha instanceof ApiError ? falha.message : "Falha ao ler o arquivo de backup.");
    } finally {
      setAnalisando(false);
    }
  };

  const trocarModo = async (novoModo: "mesclar" | "substituir") => {
    setModo(novoModo);
    if (!arquivo && !backupSistemaId) return;
    setAnalisando(true);
    try {
      setResultado(await enviar(origemAtual(), novoModo, true));
    } catch (falha) {
      setErro(falha instanceof ApiError ? falha.message : "Falha ao reanalisar o arquivo.");
    } finally {
      setAnalisando(false);
    }
  };

  const confirmar = async () => {
    if (!arquivo && !backupSistemaId) return;
    setConfirmando(true);
    try {
      const dados = await enviar(origemAtual(), modo, false);
      setResultado(dados);
      notificar({
        tipo: "sucesso",
        titulo: modo === "substituir" ? "Acervo restaurado" : "Backup aplicado ao acervo",
        descricao: `${dados.novos} prontuário(s) incluído(s) e ${dados.atualizados} atualizado(s).`,
      });
      router.refresh();
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha na restauração",
        descricao: falha instanceof ApiError ? falha.message : "Nenhuma alteração foi aplicada.",
      });
    } finally {
      setConfirmando(false);
    }
  };

  const reiniciar = () => {
    setArquivo(null);
    setBackupSistemaId(null);
    setNomeOrigemSistema(null);
    setResultado(null);
    setErro(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Cartao className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <IconShield className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">1. Baixar backup completo</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Gera um arquivo <strong>.json</strong> com <strong>todos</strong> os prontuários do
                arquivo morto (RM, nome, sobrenome e observações) e o histórico de movimentações.
                Guarde a cópia em nuvem, pendrive ou na rede da escola.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Prontuários
              </p>
              <p className="mt-0.5 text-xl font-semibold text-slate-900">{estatisticas.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sobrenomes
              </p>
              <p className="mt-0.5 text-xl font-semibold text-slate-900">
                {estatisticas.totalSobrenomes}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Último backup
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700">
                {ultimoBackup ? formatDateTime(ultimoBackup.createdAt) : "nunca gerado"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Botao
              type="button"
              variante="primario"
              carregando={gerandoCopia}
              icone={<IconDownload className="h-4 w-4" />}
              onClick={() => void salvarNoComputador()}
            >
              Salvar no computador…
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              carregando={salvandoSistema}
              icone={<IconShield className="h-4 w-4" />}
              onClick={() => void guardarNoSistema()}
            >
              Guardar cópia no sistema
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              icone={<IconEye className="h-4 w-4" />}
              onClick={() => void gerarCopia(false)}
              disabled={gerandoCopia || salvandoSistema}
            >
              Ver na tela
            </Botao>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- download de arquivo via API */}
            <a
              href="/api/prontuarios/exportar"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <IconDownload className="h-4 w-4" />
              Cópia em Excel
            </a>
          </div>

          <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs leading-relaxed text-teal-900 ring-1 ring-inset ring-teal-200">
            <strong>O download não chega ao seu computador?</strong> Isso acontece quando o
            navegador ou a rede da escola bloqueiam downloads. Três caminhos que sempre funcionam:{" "}
            <strong>1)</strong> “Salvar no computador…” abre o diálogo <em>Salvar como</em> do
            Windows (Chrome/Edge) e grava o arquivo direto no disco; <strong>2)</strong> “Guardar
            cópia no sistema” cria a cópia aqui dentro e permite restaurar com um clique, sem
            arquivo nenhum; <strong>3)</strong> “Ver na tela” mostra o conteúdo com o botão{" "}
            <strong>Copiar conteúdo</strong> (cole no Bloco de Notas e salve como{" "}
            <span className="font-mono">backup.json</span>).
          </p>

          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200">
            A cópia em Excel é ótima para conferência impressa e também pode ser reimportada, mas o
            arquivo <span className="font-mono">.json</span> é o backup oficial: preserva a data de
            cadastro e o histórico de movimentações do acervo.
          </p>
        </Cartao>

        <Cartao className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <IconRestore className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">2. Restaurar / importar backup</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Envie o backup <strong>.json</strong> ou uma planilha com RM, nome e sobrenome. Nada
                é gravado antes da sua confirmação.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <Rotulo>Como aplicar os dados</Rotulo>
              <div className="grid gap-2">
                {(
                  [
                    {
                      valor: "mesclar" as const,
                      titulo: "Mesclar (recomendado)",
                      texto: "Atualiza pelo RM e inclui os que faltam. Não apaga nada.",
                    },
                    {
                      valor: "substituir" as const,
                      titulo: "Substituir todo o acervo",
                      texto: "Apaga os prontuários atuais e grava exatamente o conteúdo do arquivo.",
                    },
                  ]
                ).map((opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    onClick={() => void trocarModo(opcao.valor)}
                    className={cx(
                      "rounded-xl border px-3.5 py-2.5 text-left transition",
                      modo === opcao.valor
                        ? "border-teal-500 bg-teal-50 ring-1 ring-inset ring-teal-500"
                        : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {modo === opcao.valor ? (
                        <IconCheck className="h-4 w-4 text-teal-700" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-slate-300" />
                      )}
                      {opcao.titulo}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{opcao.texto}</span>
                  </button>
                ))}
              </div>
            </div>

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
                "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-7 text-center transition",
                arrastando
                  ? "border-teal-400 bg-teal-50/70"
                  : "border-slate-300 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/30",
              )}
            >
              <span
                className={cx(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  analisando ? "bg-teal-100 text-teal-700" : "bg-white text-slate-500 shadow-sm",
                )}
              >
                {analisando ? <IconSpinner /> : <IconUpload />}
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {analisando ? "Conferindo o arquivo..." : "Arraste o backup aqui ou clique para escolher"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {arquivo ? `Arquivo atual: ${arquivo.name}` : "backup .json ou planilha · até 25 MB"}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".json,.xlsx,.xlsm,.csv,.txt"
                className="hidden"
                onChange={(evento) => {
                  const file = evento.target.files?.[0];
                  if (file) void analisar(file);
                }}
              />
              <Botao
                type="button"
                variante="secundario"
                className="mt-3"
                icone={<IconFile className="h-4 w-4" />}
                onClick={() => inputRef.current?.click()}
                disabled={analisando}
              >
                Selecionar arquivo
              </Botao>
            </div>
          </div>

          {erro ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <IconAlert className="mt-0.5 h-4 w-4" />
              <span>{erro}</span>
            </div>
          ) : null}
        </Cartao>
      </div>

      {resultado ? (
        <Cartao className="animar-surgir overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {resultado.confirmada ? "Restauração concluída" : "3. Confira antes de restaurar"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {resultado.arquivo} ·{" "}
                {resultado.formato === "backup-json" ? "backup do sistema" : "planilha de prontuários"}{" "}
                · modo {resultado.modo === "substituir" ? "substituir acervo" : "mesclar"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Etiqueta tom="slate">{resultado.linhasValidas} registro(s)</Etiqueta>
              <Etiqueta tom="teal">{resultado.novos} novo(s)</Etiqueta>
              <Etiqueta tom="amber">{resultado.atualizados} atualização(ões)</Etiqueta>
              <Etiqueta tom={resultado.ignorados > 0 ? "rose" : "emerald"}>
                {resultado.ignorados} ignorado(s)
              </Etiqueta>
            </div>
          </div>

          {resultado.confirmada ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
              <IconCheck className="h-5 w-5" />
              <span>
                {resultado.novos} prontuário(s) incluído(s) e {resultado.atualizados} atualizado(s).
                {resultado.importacaoId ? ` Registro de auditoria #${resultado.importacaoId}.` : ""}
              </span>
              <Link
                href="/"
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Conferir no acervo
              </Link>
            </div>
          ) : null}

          {resultado.avisos.length > 0 ? (
            <ul className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800">
              {resultado.avisos.map((aviso) => (
                <li key={aviso} className="flex gap-2 py-0.5">
                  <IconAlert className="mt-0.5 h-3.5 w-3.5" />
                  <span>{aviso}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="tabela-rolagem max-h-[24rem] overflow-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Ref.</th>
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
                Exibindo os primeiros {resultado.previa.length} de {resultado.linhasValidas}{" "}
                registros.
              </p>
            ) : null}
          </div>

          {resultado.erros.length > 0 ? (
            <details className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                {resultado.erros.length} registro(s) ignorado(s) — ver detalhes
              </summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-auto pr-2 text-xs text-slate-600">
                {resultado.erros.map((item) => (
                  <li key={`${item.linha}-${item.mensagem}`} className="flex gap-2">
                    <span className="min-w-16 font-mono text-slate-400">ref. {item.linha}</span>
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
                : "Nenhum dado foi alterado ainda. Confirme para aplicar a restauração."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Botao type="button" variante="secundario" onClick={reiniciar} disabled={confirmando}>
                {resultado.confirmada ? "Restaurar outro arquivo" : "Escolher outro arquivo"}
              </Botao>
              {!resultado.confirmada ? (
                <Botao
                  type="button"
                  variante={resultado.modo === "substituir" ? "perigo" : "primario"}
                  carregando={confirmando}
                  icone={<IconCheck className="h-4 w-4" />}
                  onClick={() => void confirmar()}
                >
                  {resultado.modo === "substituir"
                    ? `Substituir acervo (${resultado.linhasValidas})`
                    : `Restaurar ${resultado.linhasValidas} registro(s)`}
                </Botao>
              ) : null}
            </div>
          </div>
        </Cartao>
      ) : null}

      <Cartao className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Cópias guardadas no sistema</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cópias internas do acervo — restaurar por aqui não depende de download nem de arquivo
              no computador.
            </p>
          </div>
          <Botao
            type="button"
            variante="secundario"
            carregando={salvandoSistema}
            icone={<IconShield className="h-4 w-4" />}
            onClick={() => void guardarNoSistema()}
          >
            Guardar nova cópia
          </Botao>
        </div>

        {copiasSalvas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Nenhuma cópia guardada ainda. Clique em “Guardar cópia no sistema” para criar a primeira
            versão de segurança do acervo direto no servidor do sistema.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {copiasSalvas.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.nome}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(item.createdAt)} · {(item.tamanhoBytes / 1024).toFixed(1)} KB ·{" "}
                    {item.totalRegistros} registro(s)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Botao
                    type="button"
                    variante="primario"
                    className="px-2.5 py-1.5 text-xs"
                    icone={<IconRestore className="h-3.5 w-3.5" />}
                    onClick={() => void analisarCopiaDoSistema(item)}
                    disabled={analisando}
                  >
                    Restaurar
                  </Botao>
                  <Botao
                    type="button"
                    variante="secundario"
                    className="px-2.5 py-1.5 text-xs"
                    icone={<IconEye className="h-3.5 w-3.5" />}
                    onClick={() => void verCopiaDoSistema(item)}
                  >
                    Ver
                  </Botao>
                  <a
                    href={`/api/backup/arquivos/${item.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                    Baixar
                  </a>
                  <Botao
                    type="button"
                    variante="fantasma"
                    className="px-2.5 py-1.5 text-xs"
                    icone={<IconTrash className="h-3.5 w-3.5" />}
                    onClick={() => void excluirCopiaDoSistema(item)}
                  >
                    Excluir
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Modal
        aberto={copia !== null}
        onFechar={() => setCopia(null)}
        largura="max-w-3xl"
        titulo="Conteúdo do backup gerado"
        descricao={
          copia
            ? `${copia.nomeArquivo} · ${(new Blob([copia.conteudo]).size / 1024).toFixed(1)} KB · visível aqui mesmo se o download estiver bloqueado.`
            : ""
        }
        rodape={
          <>
            <Botao type="button" variante="secundario" onClick={() => setCopia(null)}>
              Fechar
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              icone={<IconCopy className="h-4 w-4" />}
              onClick={() => void copiarCopia()}
            >
              Copiar conteúdo
            </Botao>
            {copia ? (
              <Botao
                type="button"
                variante="primario"
                icone={<IconDownload className="h-4 w-4" />}
                onClick={() => salvarArquivo(copia.nomeArquivo, copia.conteudo)}
              >
                Baixar arquivo .json
              </Botao>
            ) : null}
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-3 text-xs leading-relaxed text-teal-900">
            <p>
              Três formas de guardar esta cópia: <strong>Copiar conteúdo</strong> (cole no Bloco de
              Notas e salve como <span className="font-mono">backup.json</span>),{" "}
              <strong>Baixar arquivo .json</strong> (download feito pelo próprio navegador) ou{" "}
              <a
                href="/api/backup/visualizar"
                target="_blank"
                rel="noopener"
                className="font-semibold underline underline-offset-2"
              >
                abrir em nova aba
              </a>{" "}
              para salvar com Ctrl+S. Restaure por esta mesma tela quando precisar.
            </p>
          </div>

          <textarea
            readOnly
            value={copia?.conteudo ?? ""}
            spellCheck={false}
            onFocus={(evento) => evento.currentTarget.select()}
            className="h-72 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 focus:border-teal-500 focus:outline focus:outline-2 focus:outline-teal-500"
          />
        </div>
      </Modal>

      <Cartao className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Movimentações de segurança</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Últimos backups gerados e restaurações aplicadas
            {ultimaRestauracao
              ? ` · última restauração em ${formatDateTime(ultimaRestauracao.createdAt)}`
              : " · nenhuma restauração registrada"}
            .
          </p>
        </div>

        {historico.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Nenhum backup gerado até o momento. Clique em “Baixar backup completo” para criar a
            primeira cópia de segurança do acervo.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {historico.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.arquivo}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Etiqueta tom={item.modo === "backup" ? "teal" : "amber"}>
                    {ROTULOS_MODO[item.modo] ?? item.modo}
                  </Etiqueta>
                  {item.modo !== "backup" ? (
                    <>
                      <Etiqueta tom="teal">{item.inseridos} novo(s)</Etiqueta>
                      <Etiqueta tom="slate">{item.atualizados} atualizado(s)</Etiqueta>
                    </>
                  ) : (
                    <Etiqueta tom="slate">{item.totalLinhas} prontuário(s)</Etiqueta>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
