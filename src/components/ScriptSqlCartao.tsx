"use client";

import { useState } from "react";
import { Botao, Cartao, Etiqueta, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { IconCopy, IconDownload, IconFile, IconUpload } from "@/components/icons";

const PASSOS = [
  "Abra o projeto no Supabase e entre em SQL Editor → New query.",
  "Clique em “Ver script SQL” aqui, use “Copiar script” e cole na janela do Supabase.",
  "Clique em RUN. No fim aparecem as 3 tabelas (prontuarios, importacoes, backup_arquivos).",
  "Aponte a DATABASE_URL da aplicação para o Supabase (porta 6543 do pooler) e reinicie.",
];

export function ScriptSqlCartao() {
  const { notificar } = useToast();
  const [aberto, setAberto] = useState(false);
  const [script, setScript] = useState("");
  const [carregando, setCarregando] = useState(false);

  const abrir = async () => {
    setCarregando(true);
    try {
      const resposta = await fetch("/api/setup/sql", { cache: "no-store" });
      if (!resposta.ok) throw new Error("Não foi possível carregar o script SQL.");
      setScript(await resposta.text());
      setAberto(true);
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha ao abrir o script SQL",
        descricao: falha instanceof Error ? falha.message : undefined,
      });
    } finally {
      setCarregando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(script);
      notificar({
        tipo: "sucesso",
        titulo: "Script SQL copiado",
        descricao: "Cole no SQL Editor do Supabase e clique em RUN.",
      });
      return;
    } catch {
      /* alternativa abaixo */
    }

    try {
      const area = document.createElement("textarea");
      area.value = script;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      notificar({ tipo: "sucesso", titulo: "Script SQL copiado para a área de transferência." });
    } catch {
      notificar({
        tipo: "erro",
        titulo: "O navegador bloqueou a cópia automática",
        descricao: "Clique dentro da área do script, selecione tudo (Ctrl+A) e copie (Ctrl+C).",
      });
    }
  };

  return (
    <Cartao className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <IconFile className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              Script SQL do banco (criar as tabelas no Supabase)
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Arquivo <span className="font-mono">sql/schema-arquivo-morto-supabase.sql</span> — cria
              as três tabelas e os índices, é idempotente (pode rodar várias vezes) e não precisa de
              nenhuma extensão do PostgreSQL.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Etiqueta tom="teal">prontuarios</Etiqueta>
              <Etiqueta tom="teal">importacoes</Etiqueta>
              <Etiqueta tom="teal">backup_arquivos</Etiqueta>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Botao
            type="button"
            variante="primario"
            carregando={carregando}
            icone={<IconFile className="h-4 w-4" />}
            onClick={() => void abrir()}
          >
            Ver script SQL
          </Botao>
          <a
            href="/api/setup/sql?baixar=1"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <IconDownload className="h-4 w-4" />
            Baixar .sql
          </a>
        </div>
      </div>

      <ol className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
        {PASSOS.map((passo, indice) => (
          <li key={passo} className="flex gap-2.5 text-xs leading-relaxed text-slate-600">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
              {indice + 1}
            </span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">
        Prefere linha de comando? Na raiz do projeto:{" "}
        <span className="font-mono">
          DATABASE_URL=&quot;postgresql://...:5432/postgres&quot; node scripts/setup-supabase.mjs
        </span>{" "}
        — executa exatamente este mesmo schema pelo Node.
      </p>

      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        largura="max-w-3xl"
        titulo="Script SQL — criar as tabelas no banco"
        descricao="Cole o conteúdo no SQL Editor do Supabase (ou execute no psql) e clique em RUN."
        rodape={
          <>
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
              Fechar
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              icone={<IconCopy className="h-4 w-4" />}
              onClick={() => void copiar()}
            >
              Copiar script
            </Botao>
            <a
              href="/api/setup/sql?baixar=1"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-700/25 transition hover:bg-teal-800"
            >
              <IconUpload className="h-4 w-4" />
              Baixar .sql
            </a>
          </>
        }
      >
        <textarea
          readOnly
          value={script}
          spellCheck={false}
          onFocus={(evento) => evento.currentTarget.select()}
          className="h-96 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 focus:border-teal-500 focus:outline focus:outline-2 focus:outline-teal-500"
        />
      </Modal>
    </Cartao>
  );
}
